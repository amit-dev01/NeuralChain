from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ScriptType(str, Enum):
    P2PKH = "P2PKH"
    P2SH = "P2SH"
    P2WPKH = "P2WPKH"
    P2WSH = "P2WSH"
    UNKNOWN = "UNKNOWN"


class TransactionRecord(BaseModel):
    txid: str = Field(..., min_length=8, max_length=128)
    timestamp: datetime
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    src_port: Optional[int] = Field(None, ge=0, le=65535)
    dst_port: Optional[int] = Field(None, ge=0, le=65535)
    input_addresses: List[str] = Field(default_factory=list)
    output_addresses: List[str] = Field(default_factory=list)
    input_amounts: List[float] = Field(default_factory=list)
    output_amounts: List[float] = Field(default_factory=list)
    fee: float = Field(0.0, ge=0)
    script_type: ScriptType = ScriptType.UNKNOWN
    geo_country: Optional[str] = None
    asn: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    ground_truth_label: Optional[str] = None

    @field_validator("fee")
    @classmethod
    def fee_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("fee cannot be negative")
        return v

    @field_validator("input_amounts", "output_amounts")
    @classmethod
    def amounts_non_negative(cls, v: List[float]) -> List[float]:
        for amount in v:
            if amount < 0:
                raise ValueError("amounts cannot be negative")
        return v


class SourceType(str, Enum):
    RAW_MEMPOOL = "raw_mempool"
    EXCHANGE_EXPORT = "exchange_export"
    OSINT_FEED = "osint_feed"
    SYNTHETIC = "synthetic"


class TimestampFormat(str, Enum):
    ISO_8601 = "iso_8601"
    UNIX_MS = "unix_ms"
    UNIX_S = "unix_s"


class IngestConfig(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    source_type: SourceType = SourceType.RAW_MEMPOOL
    timestamp_format: TimestampFormat = TimestampFormat.ISO_8601
    deduplicate: bool = True
    geoip_enrich: bool = True
    auto_run_ml: bool = False


class RowError(BaseModel):
    row_index: int
    field: str
    error: str


class ValidationResult(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: List[RowError]


class DatasetMeta(BaseModel):
    id: str
    label: str
    source_type: str
    file_type: str
    row_count: int
    valid_rows: int
    duplicate_count: int
    status: str
    created_at: datetime


class IngestStatusResponse(BaseModel):
    task_id: str
    status: str  # queued | running | complete | failed
    progress: int  # 0-100
    message: str
    dataset_id: Optional[str] = None
