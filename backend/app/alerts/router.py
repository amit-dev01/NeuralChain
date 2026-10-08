import logging
import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.alerts.explainer import build_shap_explanation
from app.alerts.models import (
    AlertDetail,
    AlertResponse,
    AlertStatus,
    AlertStatusUpdate,
    AlertSummaryStats,
    PaginatedAlerts,
    RiskLevel,
    SHAPExplanation,
)
from app.alerts.scorer import compute_alert_stats
from app.db.postgres import Alert, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["alerts"])


@router.get(
    "",
    response_model=PaginatedAlerts,
    summary="List, search, filter, and paginate security alerts",
)
@router.get(
    "/",
    response_model=PaginatedAlerts,
    include_in_schema=False,
)
def list_alerts(
    page: int = Query(1, ge=1, description="Page index (1-based)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    sort: str = Query("risk_score", description="Sort field: risk_score, created_at, status"),
    order: str = Query("desc", description="Sort direction: asc or desc"),
    risk_min: float = Query(0.0, ge=0.0, le=1.0, description="Minimum risk score threshold"),
    risk_max: float = Query(1.0, ge=0.0, le=1.0, description="Maximum risk score threshold"),
    model: Optional[str] = Query(None, description="Filter by model_source"),
    status: Optional[AlertStatus] = Query(None, description="Filter by alert status"),
    from_date: Optional[datetime] = Query(None, description="Start created_at timestamp"),
    to_date: Optional[datetime] = Query(None, description="End created_at timestamp"),
    search: Optional[str] = Query(None, description="Search wallet address or reasons"),
    db: Session = Depends(get_db),
) -> PaginatedAlerts:
    """Query, filter, and return paginated alerts ordered by selected metric."""
    query = db.query(Alert)

    # 1. Apply risk score range
    query = query.filter(Alert.risk_score >= risk_min, Alert.risk_score <= risk_max)

    # 2. Filter by model_source
    if model:
        query = query.filter(Alert.model_source == model)

    # 3. Filter by alert status
    if status:
        query = query.filter(Alert.status == status.value)

    # 4. Filter by date window
    if from_date:
        query = query.filter(Alert.created_at >= from_date)
    if to_date:
        query = query.filter(Alert.created_at <= to_date)

    # 5. Search keyword
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Alert.wallet_id.ilike(search_pattern),
                cast(Alert.top_reasons, String).ilike(search_pattern),
                Alert.text_explanation.ilike(search_pattern),
            )
        )

    # Count total matching rows
    total_count = query.count()

    # 6. Apply sorting
    sort_column = Alert.risk_score
    if sort == "created_at":
        sort_column = Alert.created_at
    elif sort == "status":
        sort_column = Alert.status

    if order.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 7. Apply pagination
    total_pages = max(1, math.ceil(total_count / limit))
    offset = (page - 1) * limit
    alerts_records = query.offset(offset).limit(limit).all()

    alert_responses = [
        AlertResponse(
            id=str(a.id),
            dataset_id=str(a.dataset_id) if a.dataset_id else "",
            wallet_id=a.wallet_id,
            risk_score=float(a.risk_score),
            risk_level=RiskLevel(a.risk_level.lower()) if a.risk_level else RiskLevel.LOW,
            model_source=a.model_source,
            top_reasons=a.top_reasons or [],
            evidence_txids=a.evidence_txids or [],
            shap_values=a.shap_values,
            status=AlertStatus(a.status.lower()) if a.status else AlertStatus.NEW,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in alerts_records
    ]

    return PaginatedAlerts(
        alerts=alert_responses,
        items=alert_responses,
        total=total_count,
        page=page,
        pages=total_pages,
        per_page=limit,
    )


@router.get(
    "/stats/summary",
    response_model=AlertSummaryStats,
    summary="Get aggregated summary statistics for alerts dashboard",
)
def get_alert_summary_statistics(
    db: Session = Depends(get_db),
) -> AlertSummaryStats:
    """Retrieve counts across risk levels, dismissed today, and new in the last hour."""
    return compute_alert_stats(db)


@router.get(
    "/{id}",
    response_model=AlertDetail,
    summary="Get full alert details with SHAP feature explanations",
)
def get_alert_detail(
    id: str,
    db: Session = Depends(get_db),
) -> AlertDetail:
    """Retrieve full forensic breakdown, individual model scores, and SHAP explanations for an alert."""
    try:
        parsed_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert UUID format",
        )

    alert = db.query(Alert).filter(Alert.id == parsed_uuid).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {id} not found",
        )

    # Build SHAP explanation if values present
    shap_exp: Optional[SHAPExplanation] = None
    if alert.shap_values and isinstance(alert.shap_values, dict):
        feature_vals = {
            k: float(v) for k, v in alert.shap_values.items() if isinstance(v, (int, float))
        }
        shap_exp = build_shap_explanation(
            shap_values=feature_vals,
            feature_values=feature_vals,
            model_name=alert.model_source,
            confidence=float(alert.risk_score),
        )

    return AlertDetail(
        id=str(alert.id),
        dataset_id=str(alert.dataset_id) if alert.dataset_id else "",
        wallet_id=alert.wallet_id,
        risk_score=float(alert.risk_score),
        risk_level=RiskLevel(alert.risk_level.lower()) if alert.risk_level else RiskLevel.LOW,
        model_source=alert.model_source,
        top_reasons=alert.top_reasons or [],
        evidence_txids=alert.evidence_txids or [],
        status=AlertStatus(alert.status.lower()) if alert.status else AlertStatus.NEW,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
        if_score=float(alert.if_score) if alert.if_score is not None else None,
        ae_score=float(alert.ae_score) if alert.ae_score is not None else None,
        mixing_score=float(alert.mixing_score) if alert.mixing_score is not None else None,
        xgb_score=float(alert.xgb_score) if alert.xgb_score is not None else None,
        shap_explanation=shap_exp,
        text_explanation=alert.text_explanation or (shap_exp.text_explanation if shap_exp else None),
    )


@router.patch(
    "/{id}/status",
    response_model=AlertResponse,
    summary="Update triage status of an alert",
)
def update_alert_status(
    id: str,
    payload: AlertStatusUpdate,
    db: Session = Depends(get_db),
) -> AlertResponse:
    """Transition alert status between new, under_review, confirmed, and dismissed."""
    try:
        parsed_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert UUID format",
        )

    alert = db.query(Alert).filter(Alert.id == parsed_uuid).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {id} not found",
        )

    alert.status = payload.status.value
    alert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)

    return AlertResponse(
        id=str(alert.id),
        dataset_id=str(alert.dataset_id) if alert.dataset_id else "",
        wallet_id=alert.wallet_id,
        risk_score=float(alert.risk_score),
        risk_level=RiskLevel(alert.risk_level.lower()) if alert.risk_level else RiskLevel.LOW,
        model_source=alert.model_source,
        top_reasons=alert.top_reasons or [],
        evidence_txids=alert.evidence_txids or [],
        shap_values=alert.shap_values,
        status=AlertStatus(alert.status.lower()),
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an alert record",
)
def delete_alert(
    id: str,
    db: Session = Depends(get_db),
) -> None:
    """Remove alert record permanently from PostgreSQL ledger."""
    try:
        parsed_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert UUID format",
        )

    alert = db.query(Alert).filter(Alert.id == parsed_uuid).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {id} not found",
        )

    db.delete(alert)
    db.commit()
    return None
