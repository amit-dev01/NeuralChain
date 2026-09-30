import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.ingest.models import TransactionRecord

logger = logging.getLogger(__name__)

CLASSIFIER_FEATURE_COLUMNS: List[str] = [
    "amount_roundness",
    "fee_percentile",
    "velocity_zscore",
    "address_reuse_count",
    "cluster_risk_avg",
    "fan_out_zscore",
    "peel_chain_member_flag",
    "ip_country_risk_score",
    "asn_risk_score",
]

HIGH_RISK_COUNTRIES: Dict[str, float] = {
    "RU": 0.9,
    "CN": 0.7,
    "KP": 1.0,
    "IR": 0.9,
}


def _check_roundness(out_amounts: List[float]) -> float:
    """Return 1.0 if all output amounts have < 4 decimal places, else 0.0."""
    if not out_amounts:
        return 0.0
    for amt in out_amounts:
        if amt <= 0:
            continue
        amt_str = f"{amt:.8f}".rstrip("0").rstrip(".")
        if "." in amt_str:
            num_decimals = len(amt_str.split(".")[1])
            if num_decimals >= 4:
                return 0.0
    return 1.0


def extract_classifier_features(
    transactions: List[TransactionRecord],
    alert_scores: Optional[Dict[str, float]] = None,
) -> pd.DataFrame:
    """
    Extract domain heuristic and entity risk features for Ransomware / Darknet XGBoost classification.
    Returns DataFrame: [txid] + CLASSIFIER_FEATURE_COLUMNS
    """
    cols = ["txid"] + CLASSIFIER_FEATURE_COLUMNS
    if not transactions:
        return pd.DataFrame(columns=cols)

    scores_lookup = alert_scores or {}

    # Dataset-level aggregates for z-scores
    fan_outs = [float(len(t.output_addresses or [])) for t in transactions]
    mean_fan_out = float(np.mean(fan_outs)) if fan_outs else 0.0
    std_fan_out = float(np.std(fan_outs)) if fan_outs else 1.0

    rows: List[Dict[str, Any]] = []

    for t in transactions:
        txid = t.txid
        out_amts = [float(x) for x in t.output_amounts or []]
        in_addrs = list(t.input_addresses or [])
        out_addrs = list(t.output_addresses or [])
        fan_in = len(in_addrs)
        fan_out = len(out_addrs)

        # 1. amount_roundness (< 4 decimal places)
        amount_roundness = _check_roundness(out_amts)

        # 2. fee_percentile
        # TODO: compute via scipy.stats.percentileofscore over dataset
        fee_percentile = 0.5

        # 3. velocity_zscore
        # TODO: compute from Redis time-series
        velocity_zscore = 0.0

        # 4. address_reuse_count
        address_reuse_count = float(len(set(in_addrs) & set(out_addrs)))

        # 5. cluster_risk_avg
        cluster_risks: List[float] = []
        for addr in out_addrs:
            if addr in scores_lookup:
                cluster_risks.append(scores_lookup[addr])
        if not cluster_risks and txid in scores_lookup:
            cluster_risks.append(scores_lookup[txid])
        cluster_risk_avg = float(np.mean(cluster_risks)) if cluster_risks else 0.0

        # 6. fan_out_zscore
        fan_out_zscore = float((fan_out - mean_fan_out) / (std_fan_out + 1e-9))

        # 7. peel_chain_member_flag (1 if fan_out == 1 and fan_in == 1 else 0)
        peel_chain_flag = 1.0 if (fan_out == 1 and fan_in == 1) else 0.0

        # 8. ip_country_risk_score
        geo = (t.geo_country or "").upper().strip()
        ip_country_risk = HIGH_RISK_COUNTRIES.get(geo, 0.3)

        # 9. asn_risk_score
        asn_str = (t.asn or "").lower()
        if "tor" in asn_str:
            asn_risk = 0.95
        elif "bulletproof" in asn_str:
            asn_risk = 0.9
        else:
            asn_risk = 0.2

        rows.append(
            {
                "txid": txid,
                "amount_roundness": amount_roundness,
                "fee_percentile": fee_percentile,
                "velocity_zscore": velocity_zscore,
                "address_reuse_count": address_reuse_count,
                "cluster_risk_avg": cluster_risk_avg,
                "fan_out_zscore": fan_out_zscore,
                "peel_chain_member_flag": peel_chain_flag,
                "ip_country_risk_score": ip_country_risk,
                "asn_risk_score": asn_risk,
            }
        )

    return pd.DataFrame(rows, columns=cols)
