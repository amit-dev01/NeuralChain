from typing import Dict, Optional

import numpy as np


def combine_scores(
    if_scores: np.ndarray,
    ae_scores: np.ndarray,
    weight_if: float = 0.6,
    weight_ae: float = 0.4,
) -> np.ndarray:
    """
    Combine Isolation Forest and Deep Autoencoder anomaly scores with normalized linear weighting.
    """
    assert abs(weight_if + weight_ae - 1.0) < 1e-6, "Weights must sum to 1"
    assert len(if_scores) == len(ae_scores), "Score arrays must match length"

    if len(if_scores) == 0:
        return np.array([])

    combined = (weight_if * np.asarray(if_scores)) + (weight_ae * np.asarray(ae_scores))
    return np.clip(combined, 0.0, 1.0)


def combine_all_scores(
    if_scores: np.ndarray,
    ae_scores: np.ndarray,
    mixing_scores: np.ndarray,
    xgb_scores: np.ndarray,
    weights: Optional[Dict[str, float]] = None,
) -> np.ndarray:
    """
    Combine all 4 specialized model scores (Isolation Forest, Autoencoder, Mixing Sequence, and XGBoost Classifier).
    """
    default_weights: Dict[str, float] = {
        "if": 0.20,
        "ae": 0.20,
        "mixing": 0.25,
        "xgb": 0.35,
    }
    w = weights or default_weights

    n = len(if_scores)
    assert len(ae_scores) == n and len(mixing_scores) == n and len(xgb_scores) == n, (
        "All score arrays must match length"
    )

    if n == 0:
        return np.array([])

    combined = (
        w["if"] * np.asarray(if_scores)
        + w["ae"] * np.asarray(ae_scores)
        + w["mixing"] * np.asarray(mixing_scores)
        + w["xgb"] * np.asarray(xgb_scores)
    )
    return np.clip(combined, 0.0, 1.0)
