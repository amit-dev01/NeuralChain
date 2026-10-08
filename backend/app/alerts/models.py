from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AlertStatus(str, Enum):
    NEW = "new"
    UNDER_REVIEW = "under_review"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


class RiskLevel(str, Enum):
    CRITICAL = "critical"  # > 0.9
    HIGH = "high"          # 0.7 - 0.9
    MEDIUM = "medium"      # 0.5 - 0.7
    LOW = "low"            # < 0.5


class SHAPFeature(BaseModel):
    feature: str
    value: float  # actual feature value
    shap_value: float  # SHAP contribution
    direction: str  # "increases_risk" | "decreases_risk"


class SHAPExplanation(BaseModel):
    features: List[SHAPFeature]
    base_value: float
    expected_value: float
    text_explanation: str


class AlertBase(BaseModel):
    wallet_id: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    risk_level: RiskLevel
    model_source: str
    top_reasons: List[str] = Field(default_factory=list, max_length=3)
    evidence_txids: List[str] = Field(default_factory=list)


class AlertCreate(AlertBase):
    dataset_id: str
    if_score: Optional[float] = None
    ae_score: Optional[float] = None
    mixing_score: Optional[float] = None
    xgb_score: Optional[float] = None
    shap_values: Optional[Dict[str, Any]] = None
    text_explanation: Optional[str] = None


class AlertResponse(AlertBase):
    id: str
    dataset_id: str
    status: AlertStatus
    shap_values: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("id", "dataset_id", mode="before")
    @classmethod
    def coerce_uuid_to_str(cls, v: Any) -> str:
        if v is not None:
            return str(v)
        return ""


class AlertDetail(AlertResponse):
    if_score: Optional[float] = None
    ae_score: Optional[float] = None
    mixing_score: Optional[float] = None
    xgb_score: Optional[float] = None
    shap_explanation: Optional[SHAPExplanation] = None
    text_explanation: Optional[str] = None


class AlertStatusUpdate(BaseModel):
    status: AlertStatus


class AlertSummaryStats(BaseModel):
    critical: int
    high: int
    medium: int
    low: int
    total: int
    dismissed_today: int
    new_last_hour: int


class PaginatedAlerts(BaseModel):
    alerts: List[AlertResponse]
    items: Optional[List[AlertResponse]] = None
    total: int
    page: int
    pages: int
    per_page: int
