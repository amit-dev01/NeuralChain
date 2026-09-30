import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.postgres import ModelRun, get_db
from app.db.redis_client import get_task_progress
from app.ingest.tasks import run_all_models_task
from app.ml.anomaly.tasks import run_anomaly_detection_task
from app.ml.classifier.tasks import run_classification_task
from app.ml.clustering.tasks import run_clustering_task
from app.ml.model_registry import (
    MODEL_NAMES,
    ModelInfo,
    get_model_registry,
    register_model_run,
)
from app.ml.sequence.tasks import run_mixing_detection_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ml"])


class RunModelRequest(BaseModel):
    dataset_id: str


class RunModelResponse(BaseModel):
    task_id: str
    model_name: str
    status: str = "queued"


class RunAllResponse(BaseModel):
    task_id: str
    message: str = "All 4 models queued"


class ModelStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    metrics: Dict[str, Any] = {}
    error: Optional[str] = None


@router.get(
    "/models",
    response_model=List[ModelInfo],
    summary="List all registered ML models with latest performance metrics",
)
def list_models(db: Session = Depends(get_db)) -> List[ModelInfo]:
    """Retrieve metadata, deployment readiness, and training statistics for all models."""
    return get_model_registry(db)


@router.post(
    "/run/{model_name}",
    response_model=RunModelResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger asynchronous training or inference execution for a specific model",
)
def trigger_model_run(
    model_name: str,
    payload: RunModelRequest,
    db: Session = Depends(get_db),
) -> RunModelResponse:
    """Queue model detection pipeline on specified dataset."""
    allowed_models = set(MODEL_NAMES) | {"mixing", "sequence", "lstm"}
    if model_name not in allowed_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported model '{model_name}'. Allowed: {MODEL_NAMES}",
        )

    task_id = str(uuid.uuid4())

    try:
        if model_name in ("isolation_forest", "autoencoder"):
            task = run_anomaly_detection_task.delay(payload.dataset_id)
            task_id = str(task.id)
        elif model_name == "node2vec_dbscan":
            task = run_clustering_task.delay(payload.dataset_id)
            task_id = str(task.id)
        elif model_name in ("mixing", "sequence", "lstm"):
            task = run_mixing_detection_task.delay(payload.dataset_id)
            task_id = str(task.id)
        elif model_name == "xgboost":
            task = run_classification_task.delay(payload.dataset_id)
            task_id = str(task.id)
    except Exception as e:
        logger.error("Failed to queue Celery model task for %s: %s", model_name, e)
        # Register failed record
        register_model_run(model_name, task_id, payload.dataset_id, db)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue asynchronous model task",
        )

    register_model_run(model_name, task_id, payload.dataset_id, db)

    return RunModelResponse(
        task_id=task_id,
        model_name=model_name,
        status="queued",
    )


@router.post(
    "/run/all",
    response_model=RunAllResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Chain and trigger full 4-model ensemble ML detection pipeline",
)
def trigger_all_models(
    payload: RunModelRequest,
    db: Session = Depends(get_db),
) -> RunAllResponse:
    """Dispatch Celery chain executing Anomaly, Clustering, Sequence, and Classifier models."""
    try:
        task = run_all_models_task.delay(payload.dataset_id)
        task_id = str(task.id)
    except Exception as e:
        logger.error("Failed to queue multi-model chain task: %s", e)
        task_id = str(uuid.uuid4())

    return RunAllResponse(
        task_id=task_id,
        message="All 4 models queued",
    )


@router.get(
    "/run/{task_id}/status",
    response_model=ModelStatusResponse,
    summary="Get execution status and metrics for an ML task",
)
def get_model_run_status(
    task_id: str,
    db: Session = Depends(get_db),
) -> ModelStatusResponse:
    """Retrieve task progress from Redis or fallback to PostgreSQL ModelRun record."""
    # 1. Check Redis progress
    redis_data = get_task_progress(task_id)

    # 2. Check Postgres ModelRun table
    run_record = db.query(ModelRun).filter(ModelRun.task_id == task_id).first()

    status_str = "queued"
    progress_val = 0
    metrics_dict: Dict[str, Any] = {}
    err_str: Optional[str] = None

    if redis_data:
        status_str = redis_data.get("status", "running")
        progress_val = int(redis_data.get("progress", 0))
        err_str = redis_data.get("error")

    if run_record:
        if not redis_data or status_str == "queued":
            status_str = run_record.status or "queued"
            progress_val = 100 if status_str in ("complete", "success") else 0
        metrics_dict = run_record.metrics or {}
        err_str = err_str or run_record.error_message

    # 3. Check Celery AsyncResult fallback
    if status_str in ("queued", "running") and progress_val == 0:
        try:
            from celery.result import AsyncResult

            async_res = AsyncResult(task_id, app=celery_app)
            state = async_res.state.lower()
            if state == "success":
                status_str = "complete"
                progress_val = 100
            elif state == "failure":
                status_str = "failed"
            elif state in ("started", "retry"):
                status_str = "running"
        except Exception:
            pass

    return ModelStatusResponse(
        task_id=task_id,
        status=status_str,
        progress=progress_val,
        metrics=metrics_dict,
        error=err_str,
    )
