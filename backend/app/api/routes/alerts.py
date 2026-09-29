from fastapi import APIRouter
from typing import Optional

router = APIRouter()


@router.get("/")
async def get_alerts(
    min_score: float = 0.0,
    limit: int = 100,
    offset: int = 0,
    entity_type: Optional[str] = None,
):
    """
    Get ranked, explainable alerts.
    Each alert includes: entity_id, risk_score, top_reasons, evidence_txids.
    """
    # TODO: query alert store
    return {"alerts": [], "total": 0}


@router.get("/{alert_id}")
async def get_alert_detail(alert_id: str):
    """Get full SHAP explanation for a specific alert."""
    # TODO: fetch SHAP waterfall data
    return {"alert_id": alert_id, "shap_values": {}, "evidence": []}


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str):
    """Mark an alert as reviewed/dismissed."""
    return {"alert_id": alert_id, "status": "dismissed"}
