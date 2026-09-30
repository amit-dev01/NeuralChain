import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.alerts.models import AlertSummaryStats, RiskLevel
from app.db.postgres import Alert

logger = logging.getLogger(__name__)

WEIGHT_IF = 0.20
WEIGHT_AE = 0.20
WEIGHT_MIXING = 0.25
WEIGHT_XGB = 0.35


def compute_risk_score(
    if_score: Optional[float] = None,
    ae_score: Optional[float] = None,
    mixing_score: Optional[float] = None,
    xgb_score: Optional[float] = None,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """
    Compute a combined risk score in [0.0, 1.0] using dynamically re-normalized weights
    for only the non-None model scores available.
    """
    default_weights = {
        "if": WEIGHT_IF,
        "ae": WEIGHT_AE,
        "mixing": WEIGHT_MIXING,
        "xgb": WEIGHT_XGB,
    }
    w_map = weights or default_weights

    available_components: List[tuple[float, float]] = []

    if if_score is not None:
        available_components.append((float(if_score), w_map.get("if", WEIGHT_IF)))
    if ae_score is not None:
        available_components.append((float(ae_score), w_map.get("ae", WEIGHT_AE)))
    if mixing_score is not None:
        available_components.append((float(mixing_score), w_map.get("mixing", WEIGHT_MIXING)))
    if xgb_score is not None:
        available_components.append((float(xgb_score), w_map.get("xgb", WEIGHT_XGB)))

    if not available_components:
        return 0.0

    total_weight = sum(w for _, w in available_components)
    if total_weight <= 0.0:
        return 0.0

    # Re-normalize weights so sum is 1.0
    combined_score = sum((score * (w / total_weight)) for score, w in available_components)
    return float(max(0.0, min(1.0, combined_score)))


def classify_risk_level(score: float) -> RiskLevel:
    """
    Classify a continuous risk score into categorical RiskLevel:
      score > 0.9  → CRITICAL
      score > 0.7  → HIGH
      score > 0.5  → MEDIUM
      else         → LOW
    """
    if score > 0.9:
        return RiskLevel.CRITICAL
    elif score > 0.7:
        return RiskLevel.HIGH
    elif score > 0.5:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW


def rank_alerts(alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sort alert dictionaries by risk_score descending and append 1-indexed rank field.
    """
    sorted_alerts = sorted(
        alerts,
        key=lambda a: float(a.get("risk_score", 0.0) or 0.0),
        reverse=True,
    )
    for idx, item in enumerate(sorted_alerts, start=1):
        item["rank"] = idx
    return sorted_alerts


def compute_alert_stats(db: Session) -> AlertSummaryStats:
    """
    Compute aggregate summary counts from the PostgreSQL Alert table:
    Distribution across risk levels, dismissed today, and new in the last hour.
    """
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    one_hour_ago = now - timedelta(hours=1)

    # 1. Group by risk_level counts
    risk_query = (
        db.query(Alert.risk_level, func.count(Alert.id))
        .group_by(Alert.risk_level)
        .all()
    )
    counts_by_level = {str(lvl).lower(): cnt for lvl, cnt in risk_query}

    critical_cnt = counts_by_level.get("critical", 0)
    high_cnt = counts_by_level.get("high", 0)
    medium_cnt = counts_by_level.get("medium", 0)
    low_cnt = counts_by_level.get("low", 0)
    total_cnt = sum(counts_by_level.values())

    # 2. Dismissed today
    dismissed_today = (
        db.query(func.count(Alert.id))
        .filter(Alert.status == "dismissed", Alert.updated_at >= today_start)
        .scalar()
        or 0
    )

    # 3. New within the last hour
    new_last_hour = (
        db.query(func.count(Alert.id))
        .filter(Alert.status == "new", Alert.created_at >= one_hour_ago)
        .scalar()
        or 0
    )

    return AlertSummaryStats(
        critical=critical_cnt,
        high=high_cnt,
        medium=medium_cnt,
        low=low_cnt,
        total=total_cnt,
        dismissed_today=dismissed_today,
        new_last_hour=new_last_hour,
    )
