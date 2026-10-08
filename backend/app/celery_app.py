import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from celery import Celery

    celery_app = Celery(
        "sih26146",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
        include=[
            "app.ingest.tasks",
            "app.ml.anomaly.tasks",
            "app.ml.clustering.tasks",
            "app.ml.sequence.tasks",
            "app.ml.classifier.tasks",
            "app.reports.tasks",
        ],
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
    )
    if settings.CELERY_BROKER_URL.startswith("rediss://"):
        import ssl
        celery_app.conf.update(
            broker_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},
            redis_backend_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},
        )
except ImportError:
    logger.warning("Celery library not found on local environment; fallback mock active")

    class DummyCeleryTask:
        def delay(self, *args, **kwargs):
            class DummyResult:
                id = "mock-task-id"
                state = "PENDING"

            return DummyResult()

        def s(self, *args, **kwargs):
            return self

    class DummyCelery:
        def task(self, *args, **kwargs):
            def decorator(func):
                func.delay = lambda *a, **k: DummyCeleryTask().delay(*a, **k)
                func.s = lambda *a, **k: DummyCeleryTask()
                return func

            return decorator

        @property
        def control(self):
            class DummyInspect:
                def ping(self):
                    return {}

            class DummyControl:
                def inspect(self, timeout=2.0):
                    return DummyInspect()

            return DummyControl()

    celery_app = DummyCelery()
