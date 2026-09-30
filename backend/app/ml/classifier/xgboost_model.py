import logging
import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from app.ml.mlflow_config import mlflow, start_run

logger = logging.getLogger(__name__)


class RansomwareClassifier:
    """
    Supervised gradient boosted decision tree classifier identifying ransomware, extortion,
    and darknet transaction patterns.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        random_state: int = 42,
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.random_state = random_state
        self.model: Optional[xgb.XGBClassifier] = None

    def train(self, X: pd.DataFrame, y: np.ndarray) -> Dict[str, Any]:
        """
        Train XGBoost classifier with validation split evaluation.
        y: binary labels (1 = ransomware/darknet, 0 = normal).
        """
        if len(X) == 0:
            return {
                "precision": 0.0,
                "recall": 0.0,
                "f1_score": 0.0,
                "auc_roc": 0.0,
            }

        with start_run("xgboost_classifier_train"):
            # Determine if stratification is feasible
            stratify = None
            if len(set(y)) > 1 and min(np.bincount(y.astype(int))) >= 2:
                stratify = y

            test_sz = 0.2 if len(X) >= 5 else 0.0
            if test_sz > 0:
                X_train, X_val, y_train, y_val = train_test_split(
                    X,
                    y,
                    test_size=test_sz,
                    random_state=self.random_state,
                    stratify=stratify,
                )
            else:
                X_train, X_val, y_train, y_val = X, X, y, y

            self.model = xgb.XGBClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                learning_rate=self.learning_rate,
                subsample=self.subsample,
                eval_metric="logloss",
                random_state=self.random_state,
                n_jobs=-1,
            )

            self.model.fit(
                X_train,
                y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )

            y_pred = self.model.predict(X_val)
            y_prob = self.model.predict_proba(X_val)
            # Handle single class prediction proba shape
            prob_class_1 = y_prob[:, 1] if y_prob.shape[1] > 1 else y_prob[:, 0]

            prec = float(precision_score(y_val, y_pred, zero_division=0))
            rec = float(recall_score(y_val, y_pred, zero_division=0))
            f1 = float(f1_score(y_val, y_pred, zero_division=0))
            auc = (
                float(roc_auc_score(y_val, prob_class_1))
                if len(set(y_val)) > 1
                else 0.0
            )

            metrics = {
                "precision": prec,
                "recall": rec,
                "f1_score": f1,
                "auc_roc": auc,
            }

            try:
                mlflow.log_params(
                    {
                        "n_estimators": self.n_estimators,
                        "max_depth": self.max_depth,
                        "learning_rate": self.learning_rate,
                    }
                )
                mlflow.log_metrics(metrics)
            except Exception as e:
                logger.debug("Failed to log XGBoost metrics to MLflow: %s", e)

            return metrics

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Returns probability array of being ransomware/darknet (class 1)."""
        if self.model is None:
            raise ValueError("Model not trained.")
        if len(X) == 0:
            return np.array([])
        probs = self.model.predict_proba(X)
        if probs.shape[1] > 1:
            return probs[:, 1]
        return probs[:, 0]

    def save_model(self, path: str) -> None:
        """Save booster configuration and trees to disk."""
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        if self.model is not None:
            self.model.save_model(path)
            logger.info("Saved XGBoost model to '%s'", path)

    def load_model(self, path: str) -> None:
        """Load booster configuration and trees from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at '{path}'")
        self.model = xgb.XGBClassifier()
        self.model.load_model(path)
        logger.info("Loaded XGBoost model from '%s'", path)
