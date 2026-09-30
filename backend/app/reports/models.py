from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReportType(str, Enum):
    FULL_INVESTIGATION = "full_investigation"
    ALERT_SUMMARY = "alert_summary"
    ENTITY_PROFILE = "entity_profile"
    TRANSACTION_EXPORT = "transaction_export"


class ReportFormat(str, Enum):
    PDF = "pdf"
    CSV = "csv"
    JSON = "json"


class ReportSection(str, Enum):
    EXECUTIVE_SUMMARY = "executive_summary"
    KPI_STATS = "kpi_stats"
    ALERT_TABLE = "alert_table"
    SHAP_ANALYSIS = "shap_analysis"
    GRAPH_SCREENSHOT = "graph_screenshot"
    GEO_DISTRIBUTION = "geo_distribution"
    MODEL_PERFORMANCE = "model_performance"
    RAW_TRANSACTIONS = "raw_transactions"
    EVIDENCE_LIST = "evidence_list"


class ReportConfig(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    report_type: ReportType = ReportType.ALERT_SUMMARY
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    risk_threshold: float = Field(0.5, ge=0.0, le=1.0)
    sections: List[ReportSection] = Field(
        default=[
            ReportSection.EXECUTIVE_SUMMARY,
            ReportSection.KPI_STATS,
            ReportSection.ALERT_TABLE,
        ]
    )
    format: ReportFormat = ReportFormat.PDF
    include_branding: bool = True
    analyst_notes: str = ""
    entity_wallet_id: Optional[str] = None  # for entity_profile type


class ReportMeta(BaseModel):
    id: str
    title: str
    report_type: str
    format: str
    created_at: datetime
    file_path: Optional[str] = None
    size_bytes: Optional[int] = None
    status: str  # generating | complete | failed
    section_count: int

    model_config = ConfigDict(from_attributes=True)

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return str(v) if v is not None else ""


class ReportGenerateResponse(BaseModel):
    task_id: str
    message: str
