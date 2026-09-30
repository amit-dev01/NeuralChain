import logging
import os
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.ml.mlflow_config import mlflow, start_run

logger = logging.getLogger(__name__)


class IsolationForestDetector:
    """
    Unsupervised transaction anomaly detector using tree partition isolation depth.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        n_estimators: int = 200,
        random_state: int = 42,
    ):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None

    def train(self, X: pd.DataFrame) -> Dict[str, Any]:
        """
        Train IsolationForest on feature matrix X (FEATURE_COLUMNS only, without txid).
        Returns metrics dictionary.
        """
        if len(X) == 0:
            raise ValueError("Training dataset X is empty.")

        with start_run("isolation_forest_train"):
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)

            self.model = IsolationForest(
                contamination=self.contamination,
                n_estimators=self.n_estimators,
                random_state=self.random_state,
                n_jobs=-1,
            )
            self.model.fit(X_scaled)

            raw_scores = self.model.decision_function(X_scaled)
            # Normalize: invert and min-max scale to [0, 1] (higher score = more anomalous)
            scores = self._normalize_scores(raw_scores)
            anomaly_count = int((scores > 0.5).sum())

            metrics = {
                "n_samples": len(X),
                "n_anomalies_detected": anomaly_count,
                "mean_score": float(scores.mean()),
                "contamination": self.contamination,
            }

            try:
                mlflow.log_params(
                    {
                        "contamination": self.contamination,
                        "n_estimators": self.n_estimators,
                    }
                )
                mlflow.log_metrics(metrics)
            except Exception as e:
                logger.debug("Failed to log metrics to MLflow: %s", e)

            return metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """
        Predict continuous anomaly scores in range [0.0, 1.0], where higher = more anomalous.
        """
        if self.model is None or self.scaler is None:
            raise ValueError("Model not trained. Call train() first.")

        if len(X) == 0:
            return np.array([])

        X_scaled = self.scaler.transform(X)
        raw = self.model.decision_function(X_scaled)
        return self._normalize_scores(raw)

    def _normalize_scores(self, raw: np.ndarray) -> np.ndarray:
        """
        Invert scikit-learn decision function (lower = more anomalous) and scale to [0, 1].
        """
        inverted = -raw
        min_v, max_v = inverted.min(), inverted.max()
        if max_v == min_v:
            return np.zeros_like(inverted)
        return (inverted - min_v) / (max_v - min_v)

    def save_model(self, path: str) -> None:
        """Serialize trained model and standard scaler to persistent disk storage."""
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        joblib.dump({"model": self.model, "scaler": self.scaler}, path)
        logger.info("Saved IsolationForest model to '%s'", path)

    def load_model(self, path: str) -> None:
        """Load serialized model and scaler weights from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at '{path}'")
        data = joblib.load(path)
        self.model = data["model"]
        self.scaler = data["scaler"]
        logger.info("Loaded IsolationForest model from '%s'", path)
