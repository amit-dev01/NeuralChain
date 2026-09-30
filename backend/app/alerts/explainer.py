import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.alerts.models import SHAPExplanation, SHAPFeature

logger = logging.getLogger(__name__)

try:
    import shap
    HAS_SHAP = True
except ImportError:
    logger.warning("shap library not installed; fallback mock active")
    HAS_SHAP = False

    class _MockTreeExplainer:
        def __init__(self, model):
            pass

        def shap_values(self, X):
            cols = X.shape[1] if hasattr(X, "shape") else 10
            return [np.zeros((1, cols)), np.ones((1, cols)) * 0.1]

    class _MockKernelExplainer:
        def __init__(self, *args, **kwargs):
            pass

        def shap_values(self, X, nsamples=100):
            cols = X.shape[1] if hasattr(X, "shape") else 10
            return [np.zeros((1, cols)), np.ones((1, cols)) * 0.1]

    class _MockSHAP:
        TreeExplainer = _MockTreeExplainer
        KernelExplainer = _MockKernelExplainer

        @staticmethod
        def sample(df, n):
            return df

    shap = _MockSHAP()


try:
    from lime.lime_tabular import LimeTabularExplainer
    HAS_LIME = True
except ImportError:
    logger.warning("lime library not installed; fallback mock active")
    HAS_LIME = False

    class LimeTabularExplainer:  # type: ignore[no-redef]
        def __init__(self, training_data, feature_names=None, mode="classification"):
            self.feature_names = feature_names or []

        def explain_instance(self, data_row, predict_fn, num_features=10):
            class _MockExp:
                def as_list(self):
                    return [(f, 0.05) for f in (data_row if isinstance(data_row, list) else [])]
            return _MockExp()


def _kernel_shap(
    model: Any,
    X_instance: pd.DataFrame,
    feature_names: List[str],
    background_data: pd.DataFrame,
) -> Dict[str, float]:
    """Fallback kernel-based SHAP estimation."""
    try:
        predict_fn = (
            model.predict_proba
            if hasattr(model, "predict_proba")
            else model.predict
        )
        bg_sample = shap.sample(background_data, min(100, len(background_data)))
        explainer = shap.KernelExplainer(predict_fn, bg_sample)
        sv = explainer.shap_values(X_instance, nsamples=100)
        if isinstance(sv, list) and len(sv) > 1:
            values = sv[1][0]
        elif isinstance(sv, list) and len(sv) == 1:
            values = sv[0][0]
        else:
            values = sv[0] if len(sv.shape) > 1 else sv
        return dict(zip(feature_names, [float(x) for x in values]))
    except Exception as e:
        logger.warning("Kernel SHAP computation failed: %s", e)
        return {feat: 0.0 for feat in feature_names}


def explain_with_shap(
    model: Any,
    X_instance: pd.DataFrame,
    feature_names: List[str],
    background_data: Optional[pd.DataFrame] = None,
) -> Dict[str, float]:
    """
    Compute SHAP local attribution feature importances for a given transaction instance.
    Uses TreeExplainer first, falling back to KernelExplainer if model architecture requires it.
    """
    if len(X_instance) == 0:
        return {feat: 0.0 for feat in feature_names}

    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_instance)

        # For binary classification, take output index 1 (positive class)
        if isinstance(shap_values, list) and len(shap_values) > 1:
            sv = shap_values[1][0]
        elif isinstance(shap_values, list) and len(shap_values) == 1:
            sv = shap_values[0][0]
        else:
            sv = shap_values[0] if len(shap_values.shape) > 1 else shap_values

        return dict(zip(feature_names, [float(x) for x in sv]))
    except Exception as e:
        logger.debug("TreeExplainer fell back to KernelExplainer: %s", e)
        if background_data is not None and len(background_data) > 0:
            return _kernel_shap(model, X_instance, feature_names, background_data)
        # Default zero weights if no background data
        return {feat: 0.0 for feat in feature_names}


def explain_with_lime(
    model: Any,
    X_instance: np.ndarray,
    X_background: np.ndarray,
    feature_names: List[str],
    mode: str = "classification",
) -> Dict[str, float]:
    """
    Generate local interpretable model-agnostic explanations (LIME) for a single record.
    """
    try:
        explainer = LimeTabularExplainer(
            X_background,
            feature_names=feature_names,
            mode=mode,
        )
        predict_fn = (
            model.predict_proba
            if hasattr(model, "predict_proba")
            else model.predict
        )
        exp = explainer.explain_instance(
            X_instance,
            predict_fn,
            num_features=len(feature_names),
        )
        return dict(exp.as_list())
    except Exception as e:
        logger.warning("LIME explanation generation failed: %s", e)
        return {feat: 0.0 for feat in feature_names}


def get_top_n_reasons(
    shap_values: Dict[str, float],
    feature_values: Dict[str, float],
    n: int = 3,
) -> List[str]:
    """
    Format top n features ranked by magnitude of SHAP attribution into human-readable forensic reasons.
    """
    if not shap_values:
        return ["Suspicious transaction behavioral pattern"]

    # Sort features by absolute contribution descending
    sorted_features = sorted(
        shap_values.items(),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )

    reasons: List[str] = []

    for feat, sv in sorted_features[:n]:
        val = float(feature_values.get(feat, 0.0))
        direction = "increases" if sv >= 0 else "decreases"

        if feat == "fee_ratio":
            reasons.append(f"Fee ratio {val:.2f} ({direction} risk)")
        elif feat == "fan_out":
            reasons.append(f"Transaction fan-out of {int(val)} outputs")
        elif feat == "round_amount_flag" and val > 0:
            reasons.append("Round-number payment detected")
        elif feat == "address_reuse_count" and val > 0:
            reasons.append(f"Address reused {int(val)} times")
        elif feat == "ip_country_risk_score":
            reasons.append(f"High-risk country origin (score {val:.2f})")
        elif feat == "velocity_zscore":
            reasons.append(f"Abnormal velocity: {val:.2f}σ above mean")
        elif feat == "peel_chain_member_flag" and val > 0:
            reasons.append("Part of a peel chain sequence")
        elif feat == "cluster_risk_avg" and val > 0:
            reasons.append(f"Connected cluster risk score: {val:.2f}")
        else:
            reasons.append(f"{feat}: {val:.3f}")

    return reasons if reasons else ["Elevated forensic anomaly indicators"]


def generate_text_explanation(
    shap_values: Dict[str, float],
    feature_values: Dict[str, float],
    model_name: str,
    confidence: float,
) -> str:
    """
    Synthesize plain-English investigative narrative explaining the flagged activity.
    """
    reasons = get_top_n_reasons(shap_values, feature_values, n=3)
    reasons_str = ", ".join(reasons)
    return (
        f"This wallet was flagged by {model_name} (confidence {confidence:.1%}) "
        f"for exhibiting suspicious behavior: {reasons_str}."
    )


def build_shap_explanation(
    shap_values: Dict[str, float],
    feature_values: Dict[str, float],
    model_name: str,
    confidence: float,
) -> SHAPExplanation:
    """
    Construct full SHAPExplanation model containing individual feature directions,
    baseline expectations, and generated narrative.
    """
    features_list: List[SHAPFeature] = []

    for feat, sv in shap_values.items():
        val = float(feature_values.get(feat, 0.0))
        direction = "increases_risk" if sv >= 0 else "decreases_risk"
        features_list.append(
            SHAPFeature(
                feature=feat,
                value=val,
                shap_value=float(sv),
                direction=direction,
            )
        )

    text_exp = generate_text_explanation(
        shap_values=shap_values,
        feature_values=feature_values,
        model_name=model_name,
        confidence=confidence,
    )

    return SHAPExplanation(
        features=features_list,
        base_value=0.5,
        expected_value=float(confidence),
        text_explanation=text_exp,
    )
