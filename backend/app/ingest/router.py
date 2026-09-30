import logging
import os
import shutil
import tempfile
import uuid
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.postgres import Alert, Dataset, Transaction, get_db
from app.db.redis_client import get_task_progress
from app.ingest.models import (
    DatasetMeta,
    IngestConfig,
    IngestStatusResponse,
    SourceType,
    TimestampFormat,
)
from app.ingest.tasks import ingest_file_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ingest"])


@router.post(
    "/upload",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload dataset file for asynchronous processing",
)
async def upload_file(
    file: UploadFile = File(...),
    label: str = Form(..., min_length=1, max_length=255),
    source_type: SourceType = Form(SourceType.RAW_MEMPOOL),
    timestamp_format: TimestampFormat = Form(TimestampFormat.ISO_8601),
    deduplicate: bool = Form(True),
    geoip_enrich: bool = Form(True),
    auto_run_ml: bool = Form(False),
    db: Session = Depends(get_db),
):
    """Accept and validate a CSV, JSON, or XML file, initialize tracking, and queue ingestion."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty",
        )

    ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    if ext not in ("csv", "json", "xml"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '.{ext}'. Allowed types: .csv, .json, .xml",
        )

    # Save uploaded file to temp directory
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{os.path.basename(file.filename)}"
    saved_path = os.path.join(temp_dir, unique_filename)

    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error("Failed to write uploaded file to disk: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file to storage",
        )

    config = IngestConfig(
        label=label,
        source_type=source_type,
        timestamp_format=timestamp_format,
        deduplicate=deduplicate,
        geoip_enrich=geoip_enrich,
        auto_run_ml=auto_run_ml,
    )

    # Create dataset record
    dataset_id = uuid.uuid4()
    dataset_record = Dataset(
        id=dataset_id,
        label=label,
        source_type=source_type.value,
        file_type=ext,
        row_count=0,
        valid_rows=0,
        duplicate_count=0,
        status="pending",
    )
    db.add(dataset_record)
    db.commit()

    # Queue Celery ingestion task
    try:
        task = ingest_file_task.delay(
            saved_path,
            config.model_dump(),
            str(dataset_id),
        )
        task_id = str(task.id)
    except Exception as e:
        logger.error("Failed to queue Celery ingestion task: %s", e)
        dataset_record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue asynchronous ingestion task",
        )

    return {
        "task_id": task_id,
        "dataset_id": str(dataset_id),
        "message": "Ingestion queued",
    }


@router.get(
    "/status/{task_id}",
    response_model=IngestStatusResponse,
    summary="Get ingestion task progress and status",
)
async def get_ingest_status(task_id: str):
    """Retrieve task progress from Redis or fallback to Celery AsyncResult inspection."""
    progress_data = get_task_progress(task_id)
    if progress_data:
        return IngestStatusResponse(
            task_id=task_id,
            status=progress_data.get("status", "running"),
            progress=int(progress_data.get("progress", 0)),
            message=progress_data.get("message", "Processing dataset..."),
            dataset_id=progress_data.get("dataset_id"),
        )

    # Fallback to Celery AsyncResult
    try:
        from celery.result import AsyncResult

        async_res = AsyncResult(task_id, app=celery_app)
        state = async_res.state.lower()
        status_map = {
            "pending": "queued",
            "started": "running",
            "success": "complete",
            "failure": "failed",
            "retry": "running",
        }
        mapped_status = status_map.get(state, "running")
        progress = 100 if mapped_status == "complete" else 0
        return IngestStatusResponse(
            task_id=task_id,
            status=mapped_status,
            progress=progress,
            message=f"Task state: {state}",
            dataset_id=None,
        )
    except Exception as e:
        logger.debug("Could not inspect Celery AsyncResult for %s: %s", task_id, e)
        return IngestStatusResponse(
            task_id=task_id,
            status="queued",
            progress=0,
            message="Task queued or waiting for worker...",
            dataset_id=None,
        )


@router.get(
    "/datasets",
    response_model=List[DatasetMeta],
    summary="List all historical ingested datasets",
)
async def list_datasets(db: Session = Depends(get_db)):
    """Retrieve all datasets ordered by creation date descending."""
    records = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return [
        DatasetMeta(
            id=str(r.id),
            label=r.label,
            source_type=r.source_type or "",
            file_type=r.file_type or "",
            row_count=r.row_count,
            valid_rows=r.valid_rows,
            duplicate_count=r.duplicate_count,
            status=r.status,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.delete(
    "/datasets/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dataset and cascade across PostgreSQL and Neo4j",
)
async def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Remove dataset and purge linked transactions, alerts and graph entities."""
    try:
        parsed_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format",
        )

    dataset = db.query(Dataset).filter(Dataset.id == parsed_uuid).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID {dataset_id} not found",
        )

    # 1. Delete transactions
    db.query(Transaction).filter(Transaction.dataset_id == parsed_uuid).delete()

    # 2. Delete alerts
    db.query(Alert).filter(Alert.dataset_id == parsed_uuid).delete()

    # 3. Delete dataset record
    db.delete(dataset)
    db.commit()

    # 4. Delete Neo4j nodes linked to this dataset
    try:
        from app.db.neo4j_client import run_query

        run_query(
            "MATCH (n {dataset_id: $id}) DETACH DELETE n",
            {"id": str(dataset_id)},
        )
    except Exception as e:
        logger.warning("Failed to detach/delete Neo4j nodes for dataset %s: %s", dataset_id, e)

    return None
