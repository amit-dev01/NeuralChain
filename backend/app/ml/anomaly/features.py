import math
from typing import Any, Dict, List, Union

import numpy as np
import pandas as pd

from app.ingest.models import TransactionRecord

FEATURE_COLUMNS: List[str] = [
    "fee_ratio",
    "fan_in",
    "fan_out",
    "amount_total_in",
    "amount_total_out",
    "amount_std_in",
    "amount_std_out",
    "amount_log",
    "round_amount_flag",
    "address_reuse_count",
    "script_type_encoded",
    "velocity_flag",
]

SCRIPT_TYPE_MAP: Dict[str, int] = {
    "P2PKH": 0,
    "P2SH": 1,
    "P2WPKH": 2,
    "P2WSH": 3,
    "UNKNOWN": 4,
}


def _safe_float_list(val: Any) -> List[float]:
    """Coerce various formats into a list of floats."""
    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        res = []
        for x in val:
            try:
                res.append(float(x))
            except (ValueError, TypeError):
                continue
        return res
    try:
        return [float(val)]
    except (ValueError, TypeError):
        return []


def _safe_str_list(val: Any) -> List[str]:
    """Coerce various formats into a list of strings."""
    if val is None:
        return []
    if isinstance(val, (list, tuple, set)):
        return [str(x).strip() for x in val if x is not None]
    return [str(val).strip()]


def extract_anomaly_features(
    transactions: Union[List[TransactionRecord], pd.DataFrame, List[Dict[str, Any]]]
) -> pd.DataFrame:
    """
    Compute domain and forensic features per transaction for anomaly detection models.
    Returns a pandas DataFrame with txid and all FEATURE_COLUMNS.
    """
    rows: List[Dict[str, Any]] = []

    # If transactions is a DataFrame, convert to dict records
    tx_list: List[Any]
    if isinstance(transactions, pd.DataFrame):
        tx_list = transactions.to_dict(orient="records")
    else:
        tx_list = list(transactions)

    for item in tx_list:
        if isinstance(item, TransactionRecord):
            txid = item.txid
            fee = float(item.fee or 0.0)
            in_addrs = list(item.input_addresses or [])
            out_addrs = list(item.output_addresses or [])
            in_amts = [float(x) for x in item.input_amounts or []]
            out_amts = [float(x) for x in item.output_amounts or []]
            s_type_val = item.script_type.value if hasattr(item.script_type, "value") else str(item.script_type)
        elif isinstance(item, dict):
            txid = str(item.get("txid", ""))
            fee = float(item.get("fee", 0.0) or 0.0)
            in_addrs = _safe_str_list(item.get("input_addresses"))
            out_addrs = _safe_str_list(item.get("output_addresses"))
            in_amts = _safe_float_list(item.get("input_amounts"))
            out_amts = _safe_float_list(item.get("output_amounts"))
            s_type_val = str(item.get("script_type") or "UNKNOWN")
        else:
            # Handle arbitrary object with attributes
            txid = str(getattr(item, "txid", ""))
            fee = float(getattr(item, "fee", 0.0) or 0.0)
            in_addrs = _safe_str_list(getattr(item, "input_addresses", []))
            out_addrs = _safe_str_list(getattr(item, "output_addresses", []))
            in_amts = _safe_float_list(getattr(item, "input_amounts", []))
            out_amts = _safe_float_list(getattr(item, "output_amounts", []))
            s_raw = getattr(item, "script_type", "UNKNOWN")
            s_type_val = s_raw.value if hasattr(s_raw, "value") else str(s_raw)

        # 1. Total amounts
        sum_in = float(sum(in_amts)) if in_amts else 0.0
        sum_out = float(sum(out_amts)) if out_amts else 0.0

        # 2. Fee ratio: fee / sum(input_amounts) if sum(input_amounts) > 0 else 0.0
        fee_ratio = (fee / sum_in) if sum_in > 0.0 else 0.0

        # 3. Fan-in and Fan-out
        fan_in = len(in_addrs)
        fan_out = len(out_addrs)

        # 4. Standard deviations
        std_in = float(np.std(in_amts)) if len(in_amts) > 1 else 0.0
        std_out = float(np.std(out_amts)) if len(out_amts) > 1 else 0.0

        # 5. Amount log (log1p of total input amount)
        amount_log = float(np.log1p(max(0.0, sum_in)))

        # 6. Round amount flag: 1 if any output amount is round (modulo 0.001 BTC < 1e-8)
        round_flag = 0
        for out_amt in out_amts:
            if out_amt > 0.0:
                rem = out_amt % 0.001
                if rem < 1e-8 or abs(rem - 0.001) < 1e-8:
                    round_flag = 1
                    break

        # 7. Address reuse count: appearances in both input and output sets
        set_in = set(in_addrs)
        set_out = set(out_addrs)
        reuse_count = len(set_in & set_out)

        # 8. Script type ordinal encoding
        script_code = SCRIPT_TYPE_MAP.get(s_type_val.upper(), 4)

        # 9. Velocity flag
        # TODO: compute from Redis time-series in production
        velocity_flag = 0.0

        rows.append(
            {
                "txid": txid,
                "fee_ratio": fee_ratio,
                "fan_in": fan_in,
                "fan_out": fan_out,
                "amount_total_in": sum_in,
                "amount_total_out": sum_out,
                "amount_std_in": std_in,
                "amount_std_out": std_out,
                "amount_log": amount_log,
                "round_amount_flag": round_flag,
                "address_reuse_count": reuse_count,
                "script_type_encoded": script_code,
                "velocity_flag": velocity_flag,
            }
        )

    columns = ["txid"] + FEATURE_COLUMNS
    if not rows:
        return pd.DataFrame(columns=columns)

    return pd.DataFrame(rows, columns=columns)
