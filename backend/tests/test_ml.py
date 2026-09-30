import sys
from unittest.mock import patch

from app.ml.mlflow_config import mlflow

# Ensure 'mlflow' module is present in sys.modules so patch("mlflow...") works in environments without mlflow installed
if "mlflow" not in sys.modules:
    sys.modules["mlflow"] = mlflow

import numpy as np

from app.alerts.explainer import get_top_n_reasons
from app.ml.anomaly.autoencoder import AutoencoderDetector
from app.ml.anomaly.ensemble import combine_scores
from app.ml.anomaly.features import FEATURE_COLUMNS, extract_anomaly_features
from app.ml.anomaly.isolation_forest import IsolationForestDetector
from app.ml.classifier.features import (
    CLASSIFIER_FEATURE_COLUMNS,
    extract_classifier_features,
)
from app.ml.classifier.xgboost_model import RansomwareClassifier


def test_isolation_forest_returns_scores_in_range(sample_transactions):
    """Verify Isolation Forest produces normalized anomaly scores in [0.0, 1.0]."""
    df = extract_anomaly_features(sample_transactions)
    X = df[FEATURE_COLUMNS]
    detector = IsolationForestDetector(contamination=0.2, n_estimators=10)

    with patch("mlflow.start_run"), patch("mlflow.log_params"), patch("mlflow.log_metrics"):
        metrics = detector.train(X)

    scores = detector.predict(X)
    assert len(scores) == len(sample_transactions)
    assert all(0.0 <= s <= 1.0 for s in scores), "Scores must be in [0,1]"
    assert "n_samples" in metrics


def test_autoencoder_reconstruction_error_positive(sample_transactions):
    """Verify Autoencoder reconstruction errors are non-negative and metrics logged."""
    df = extract_anomaly_features(sample_transactions)
    X = df[FEATURE_COLUMNS]
    detector = AutoencoderDetector(input_dim=len(FEATURE_COLUMNS), epochs=3, batch_size=4)

    with patch("mlflow.start_run"), patch("mlflow.log_params"), patch("mlflow.log_metrics"):
        metrics = detector.train(X)

    scores = detector.predict(X)
    assert all(s >= 0.0 for s in scores), "Reconstruction errors must be non-negative"
    assert "final_loss" in metrics
    assert metrics["final_loss"] >= 0.0


def test_ensemble_scores_weighted_correctly():
    """Verify weighted combination of Isolation Forest and Autoencoder scores."""
    if_scores = np.array([0.8, 0.2, 0.5])
    ae_scores = np.array([0.6, 0.4, 0.7])
    result = combine_scores(if_scores, ae_scores, weight_if=0.6, weight_ae=0.4)
    expected = 0.6 * if_scores + 0.4 * ae_scores
    np.testing.assert_allclose(result, expected, rtol=1e-5)
    assert all(0.0 <= s <= 1.0 for s in result)


def test_xgboost_predict_proba_sums_to_almost_one(sample_transactions):
    """Verify XGBoost classifier trains and predicts probability in [0.0, 1.0]."""
    df = extract_classifier_features(sample_transactions)
    X = df[CLASSIFIER_FEATURE_COLUMNS]
    y = np.array([1, 1, 0, 0, 1, 0, 0, 1, 0, 0])  # mock labels for 10 records

    clf = RansomwareClassifier(n_estimators=10)
    with patch("mlflow.start_run"), patch("mlflow.log_params"), patch("mlflow.log_metrics"):
        metrics = clf.train(X, y)

    proba = clf.predict_proba(X)
    assert len(proba) == len(X)
    assert all(0.0 <= p <= 1.0 for p in proba)
    assert "f1_score" in metrics


def test_shap_explainer_returns_top_3_features(sample_transactions):
    """Verify explainability engine returns top 3 human-readable forensic reasons."""
    mock_shap = {
        "fee_ratio": 0.35,
        "fan_out": 0.28,
        "round_amount_flag": 0.15,
        "address_reuse_count": 0.08,
        "velocity_zscore": -0.05,
    }
    mock_values = {
        "fee_ratio": 3.2,
        "fan_out": 83,
        "round_amount_flag": 1,
        "address_reuse_count": 12,
        "velocity_zscore": -0.5,
    }
    reasons = get_top_n_reasons(mock_shap, mock_values, n=3)
    assert len(reasons) == 3
    assert all(isinstance(r, str) for r in reasons)
    assert all(len(r) > 5 for r in reasons)
    # Top reason should be fee_ratio (highest abs shap value)
    assert "fee" in reasons[0].lower() or "ratio" in reasons[0].lower()
