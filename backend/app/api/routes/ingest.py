from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from typing import List

router = APIRouter()


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a CSV, JSON, or XML file for ingestion.
    Triggers async Celery task for parsing + GeoIP enrichment.
    """
    # TODO: save file, dispatch celery task
    return {"filename": file.filename, "status": "queued"}


@router.get("/status/{task_id}")
async def get_ingest_status(task_id: str):
    """Check ingestion task status."""
    # TODO: query Celery result
    return {"task_id": task_id, "status": "pending"}
