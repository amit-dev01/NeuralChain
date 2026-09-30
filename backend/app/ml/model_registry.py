import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.postgres import ModelRun

logger = logging.getLogger(__name__)

MODEL_NAMES = ["isolation_forest", "autoencoder", "node2vec_dbscan", "xgboost"]

DISPLAY_NAMES: Dict[str, str] = {
    "isolation_forest": "Isolation Forest Anomaly Detector",
    "autoencoder": "Deep Autoencoder Anomaly Detector",
    "node2vec_dbscan": "Node2Vec + DBSCAN Clusterer",
    "xgboost": "XGBoost Illicit Activity Classifier",
}


class ModelInfo(BaseModel):
    name: str
    display_name: str
    version: Optional[str] = None
    status: str  # "untrained" | "training" | "ready" | "error"
    last_trained: Optional[datetime] = None
    metrics: Dict[str, Any] = {}
    model_path: Optional[str] = None


def get_model_registry(db: Session) -> List[ModelInfo]:
    """
    Query the ModelRun table to locate the latest execution status and metrics for all 4 models.
    Returns list of ModelInfo instances.
    """
    registry_list: List[ModelInfo] = []

    for name in MODEL_NAMES:
        display_name = DISPLAY_NAMES.get(name, name.replace("_", " ").title())
        run = (
            db.query(ModelRun)
            .filter(ModelRun.model_name == name)
            .order_by(ModelRun.created_at.desc())
            .first()
        )

        if run is None:
            registry_list.append(
                ModelInfo(
                    name=name,
                    display_name=display_name,
                    version=None,
                    status="untrained",
                    last_trained=None,
                    metrics={},
                    model_path=None,
                )
            )
        else:
            # Map database status to standard registry status
            raw_status = (run.status or "").lower()
            if raw_status in ("complete", "success"):
                ui_status = "ready"
            elif raw_status in ("queued", "running", "training"):
                ui_status = "training"
            elif raw_status in ("failed", "error"):
                ui_status = "error"
            else:
                ui_status = raw_status or "untrained"

            version_str = str(run.id)[:8] if run.id else "v1.0"
            model_file_ext = ".joblib" if name == "isolation_forest" else ".pt" if name == "autoencoder" else ".pkl"
            model_path_str = f"{settings.MODEL_STORE_PATH}/{name}_{run.dataset_id}{model_file_ext}" if run.dataset_id else None

            registry_list.append(
                ModelInfo(
                    name=name,
                    display_name=display_name,
                    version=version_str,
                    status=ui_status,
                    last_trained=run.completed_at or run.created_at,
                    metrics=run.metrics or {},
                    model_path=model_path_str,
                )
            )

    return registry_list


def register_model_run(
    model_name: str, task_id: str, dataset_id: str, db: Session
) -> ModelRun:
    """
    Create a new ModelRun record with status='queued' and commit to PostgreSQL.
    """
    parsed_dataset_uuid = None
    try:
        parsed_dataset_uuid = uuid.UUID(str(dataset_id))
    except (ValueError, TypeError):
        pass

    record = ModelRun(
        id=uuid.uuid4(),
        model_name=model_name,
        task_id=task_id,
        dataset_id=parsed_dataset_uuid,
        status="queued",
        metrics={},
        started_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("Registered model run %s for model '%s'", task_id, model_name)
    return record


def update_model_run(
    task_id: str, status: str, metrics: Dict[str, Any], db: Session
) -> None:
    """
    Update an existing ModelRun record's status, metrics, and completion timestamp.
    """
    run = db.query(ModelRun).filter(ModelRun.task_id == task_id).first()
    if run:
        run.status = status
        if metrics:
            run.metrics = metrics
        if status in ("complete", "success", "failed", "error"):
            run.completed_at = datetime.utcnow()
        db.commit()
        logger.info("Updated model run %s status to '%s'", task_id, status)
    else:
        logger.warning("ModelRun with task_id %s not found for update", task_id)
