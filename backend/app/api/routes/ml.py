from fastapi import APIRouter

router = APIRouter()


@router.post("/run")
async def run_ml_pipeline():
    """Trigger the full ML detection pipeline asynchronously."""
    # TODO: dispatch all ML celery tasks
    return {"status": "triggered", "tasks": []}


@router.get("/anomaly/results")
async def get_anomaly_results():
    """Get Isolation Forest + Autoencoder anomaly scores."""
    return {"results": []}


@router.get("/clusters/results")
async def get_cluster_results():
    """Get Node2Vec + DBSCAN wallet cluster results."""
    return {"results": []}


@router.get("/sequence/results")
async def get_sequence_results():
    """Get LSTM mixing/tumbling detection results."""
    return {"results": []}


@router.get("/classifier/results")
async def get_classifier_results():
    """Get XGBoost ransomware/darknet classifier results."""
    return {"results": []}
