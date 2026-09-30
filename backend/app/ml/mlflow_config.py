import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import mlflow
except ImportError:
    logger.warning("MLflow package not installed in current environment; activating fallback mock")

    class DummyActiveRun:
        def __init__(self, run_id: str = "mock-run-id"):
            self.info = type("RunInfo", (), {"run_id": run_id})()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    class DummyMLflow:
        def set_tracking_uri(self, uri: str) -> None:
            pass

        def get_experiment_by_name(self, name: str) -> Any:
            return None

        def create_experiment(self, name: str) -> str:
            return "0"

        def start_run(self, *args, **kwargs) -> DummyActiveRun:
            return DummyActiveRun()

        def log_params(self, params: dict) -> None:
            pass

        def log_metrics(self, metrics: dict) -> None:
            pass

        def log_metric(self, key: str, value: float, step: int = 0) -> None:
            pass

        def log_param(self, key: str, value: Any) -> None:
            pass

        def log_artifact(self, local_path: str, artifact_path: str | None = None) -> None:
            pass

    mlflow = DummyMLflow()


def setup_mlflow() -> None:
    """Configure MLflow tracking URI and ensure target experiment exists."""
    try:
        mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)
        get_or_create_experiment(settings.MLFLOW_EXPERIMENT_NAME)
    except Exception as e:
        logger.warning("Failed to setup MLflow tracking: %s", e)


def get_or_create_experiment(name: str) -> str:
    """Retrieve existing MLflow experiment ID or create a new experiment."""
    try:
        experiment = mlflow.get_experiment_by_name(name)
        if experiment is None:
            return str(mlflow.create_experiment(name))
        return str(experiment.experiment_id)
    except Exception as e:
        logger.warning("Error retrieving or creating MLflow experiment '%s': %s", name, e)
        return "0"


def start_run(run_name: str) -> Any:
    """Initialize MLflow tracking context and start a managed run."""
    setup_mlflow()
    try:
        exp_id = get_or_create_experiment(settings.MLFLOW_EXPERIMENT_NAME)
        return mlflow.start_run(
            experiment_id=exp_id,
            run_name=run_name,
        )
    except Exception as e:
        logger.warning("Could not start MLflow run '%s': %s", run_name, e)
        if hasattr(mlflow, "start_run"):
            return mlflow.start_run()
        class MinimalRun:
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc_val, exc_tb):
                pass
        return MinimalRun()
