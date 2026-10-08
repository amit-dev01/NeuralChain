import json
import logging
import math
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, List, Tuple

from dateutil import parser as date_parser
from pydantic import ValidationError

from app.ingest.models import RowError, TimestampFormat, TransactionRecord

logger = logging.getLogger(__name__)


def detect_file_type(filename: str) -> str:
    """Determine file extension format. Raises ValueError if unsupported."""
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if ext in ("csv", "json", "xml"):
        return ext
    raise ValueError(f"Unsupported file format '.{ext}'. Must be csv, json, or xml.")


def _parse_timestamp(value: Any, fmt: TimestampFormat) -> datetime:
    """Parse various timestamp formats into UTC datetime object."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        raise ValueError("Timestamp is missing or null")

    try:
        if fmt == TimestampFormat.UNIX_MS:
            val_float = float(value)
            return datetime.fromtimestamp(val_float / 1000.0, tz=timezone.utc)
        elif fmt == TimestampFormat.UNIX_S:
            val_float = float(value)
            return datetime.fromtimestamp(val_float, tz=timezone.utc)
        else:  # ISO_8601
            val_str = str(value).strip()
            # Try standard isoformat first
            try:
                return datetime.fromisoformat(val_str.replace("Z", "+00:00"))
            except Exception:
                return date_parser.parse(val_str)
    except Exception as e:
        raise ValueError(f"Failed to parse timestamp '{value}' with format {fmt}: {e}")


def _parse_list(val: Any) -> List[str]:
    """Parse list values from string, json or delimited formats."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if x is not None]
    if isinstance(val, str):
        val = val.strip()
        if not val or val.lower() == "nan":
            return []
        if val.startswith("[") and val.endswith("]"):
            try:
                parsed = json.loads(val.replace("'", '"'))
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if x is not None]
            except Exception:
                pass
        if ";" in val:
            return [x.strip() for x in val.split(";") if x.strip()]
        if "," in val:
            return [x.strip() for x in val.split(",") if x.strip()]
        return [val]
    return [str(val)]


def _parse_float_list(val: Any) -> List[float]:
    """Parse float list from various formats."""
    items = _parse_list(val)
    floats: List[float] = []
    for item in items:
        try:
            floats.append(float(item))
        except (ValueError, TypeError):
            continue
    return floats


def parse_csv(
    file_path: str, timestamp_format: TimestampFormat = TimestampFormat.ISO_8601
) -> Tuple[List[TransactionRecord], List[RowError]]:
    """Parse CSV transaction metadata using pandas."""
    valid_records: List[TransactionRecord] = []
    row_errors: List[RowError] = []

    try:
        df = pd.read_csv(file_path, dtype=object)
    except Exception as e:
        row_errors.append(RowError(row_index=0, field="file", error=f"Could not read CSV file: {e}"))
        return valid_records, row_errors

    required_cols = {"txid", "timestamp"}
    missing = required_cols - set(df.columns)
    if missing:
        row_errors.append(
            RowError(row_index=0, field="columns", error=f"Missing mandatory CSV columns: {missing}")
        )
        return valid_records, row_errors

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        try:
            ts_val = _parse_timestamp(row_dict.get("timestamp"), timestamp_format)
            record_data = {
                "txid": str(row_dict.get("txid", "")).strip(),
                "timestamp": ts_val,
                "src_ip": row_dict.get("src_ip") if pd.notna(row_dict.get("src_ip")) else None,
                "dst_ip": row_dict.get("dst_ip") if pd.notna(row_dict.get("dst_ip")) else None,
                "src_port": int(row_dict["src_port"]) if pd.notna(row_dict.get("src_port")) else None,
                "dst_port": int(row_dict["dst_port"]) if pd.notna(row_dict.get("dst_port")) else None,
                "input_addresses": _parse_list(row_dict.get("input_addresses")),
                "output_addresses": _parse_list(row_dict.get("output_addresses")),
                "input_amounts": _parse_float_list(row_dict.get("input_amounts")),
                "output_amounts": _parse_float_list(row_dict.get("output_amounts")),
                "fee": float(row_dict.get("fee", 0.0)) if pd.notna(row_dict.get("fee")) else 0.0,
                "script_type": row_dict.get("script_type") or "UNKNOWN",
                "geo_country": row_dict.get("geo_country") if pd.notna(row_dict.get("geo_country")) else None,
                "asn": row_dict.get("asn") if pd.notna(row_dict.get("asn")) else None,
                "city": row_dict.get("city") if pd.notna(row_dict.get("city")) else None,
                "lat": float(row_dict["lat"]) if pd.notna(row_dict.get("lat")) else None,
                "lon": float(row_dict["lon"]) if pd.notna(row_dict.get("lon")) else None,
                "ground_truth_label": row_dict.get("ground_truth_label")
                if pd.notna(row_dict.get("ground_truth_label"))
                else None,
            }
            rec = TransactionRecord.model_validate(record_data)
            valid_records.append(rec)
        except (ValidationError, ValueError, TypeError) as err:
            row_errors.append(RowError(row_index=int(idx), field="record", error=str(err)))

    return valid_records, row_errors


def parse_json(
    file_path: str, timestamp_format: TimestampFormat = TimestampFormat.ISO_8601
) -> Tuple[List[TransactionRecord], List[RowError]]:
    """Parse JSON transaction metadata from array or root transactions dictionary."""
    valid_records: List[TransactionRecord] = []
    row_errors: List[RowError] = []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        row_errors.append(RowError(row_index=0, field="file", error=f"Could not read JSON file: {e}"))
        return valid_records, row_errors

    tx_list: List[Any]
    if isinstance(data, list):
        tx_list = data
    elif isinstance(data, dict) and "transactions" in data and isinstance(data["transactions"], list):
        tx_list = data["transactions"]
    else:
        row_errors.append(
            RowError(
                row_index=0,
                field="structure",
                error="Expected a JSON array or an object with a 'transactions' key",
            )
        )
        return valid_records, row_errors

    for idx, item in enumerate(tx_list):
        if not isinstance(item, dict):
            row_errors.append(RowError(row_index=idx, field="type", error="Transaction item is not a dictionary"))
            continue
        try:
            item_copy = dict(item)
            if "timestamp" in item_copy:
                item_copy["timestamp"] = _parse_timestamp(item_copy["timestamp"], timestamp_format)
            rec = TransactionRecord.model_validate(item_copy)
            valid_records.append(rec)
        except (ValidationError, ValueError, TypeError) as err:
            row_errors.append(RowError(row_index=idx, field="record", error=str(err)))

    return valid_records, row_errors


def parse_xml(
    file_path: str, timestamp_format: TimestampFormat = TimestampFormat.ISO_8601
) -> Tuple[List[TransactionRecord], List[RowError]]:
    """Parse XML transaction records according to the standard transactions schema."""
    valid_records: List[TransactionRecord] = []
    row_errors: List[RowError] = []

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
    except Exception as e:
        row_errors.append(RowError(row_index=0, field="file", error=f"Could not parse XML: {e}"))
        return valid_records, row_errors

    tx_elements = root.findall(".//transaction")
    if not tx_elements and root.tag == "transaction":
        tx_elements = [root]

    for idx, tx_elem in enumerate(tx_elements):
        try:
            d: dict[str, Any] = {}
            for child in tx_elem:
                tag = child.tag
                if tag in ("input_addresses", "output_addresses"):
                    addrs = [sub.text.strip() for sub in child if sub.text]
                    d[tag] = addrs if addrs else _parse_list(child.text)
                elif tag in ("input_amounts", "output_amounts"):
                    amounts = [float(sub.text.strip()) for sub in child if sub.text]
                    d[tag] = amounts if amounts else _parse_float_list(child.text)
                elif tag in ("src_port", "dst_port"):
                    d[tag] = int(child.text.strip()) if child.text else None
                elif tag in ("fee", "lat", "lon"):
                    d[tag] = float(child.text.strip()) if child.text else None
                else:
                    d[tag] = child.text.strip() if child.text else None

            if "timestamp" in d and d["timestamp"]:
                d["timestamp"] = _parse_timestamp(d["timestamp"], timestamp_format)

            rec = TransactionRecord.model_validate(d)
            valid_records.append(rec)
        except (ValidationError, ValueError, TypeError) as err:
            row_errors.append(RowError(row_index=idx, field="record", error=str(err)))

    return valid_records, row_errors
