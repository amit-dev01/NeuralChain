from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "neuralchain",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.ingest.tasks",
        "app.ml.anomaly.tasks",
        "app.ml.clustering.tasks",
        "app.ml.sequence.tasks",
        "app.ml.classifier.tasks",
        "app.alerts.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
