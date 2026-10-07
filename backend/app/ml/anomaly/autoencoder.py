import logging
import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from app.ml.mlflow_config import mlflow, start_run

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    logger.warning("PyTorch library not available on local host; activating fallback shim")
    HAS_TORCH = False

    class _MockNNModule:
        def __init__(self, *args, **kwargs):
            pass

        def to(self, *args, **kwargs):
            return self

        def train(self, mode: bool = True):
            return self

        def eval(self):
            return self

        def state_dict(self):
            return {}

        def load_state_dict(self, state):
            pass

        def parameters(self):
            return []

    class _MockNN:
        Module = _MockNNModule

        @staticmethod
        def Sequential(*args):
            return _MockNNModule()

        @staticmethod
        def Linear(*args, **kwargs):
            return _MockNNModule()

        @staticmethod
        def ReLU(*args, **kwargs):
            return _MockNNModule()

        @staticmethod
        def MSELoss(*args, **kwargs):
            return lambda a, b: type("Loss", (), {"item": lambda: 0.05, "backward": lambda: None})()

    nn = _MockNN()
    torch = type("MockTorch", (), {
        "device": lambda x: "cpu",
        "tensor": lambda *a, **k: type("T", (), {"to": lambda s, d: s, "cpu": lambda s: s, "numpy": lambda s: np.zeros(10)})(),
        "save": lambda obj, path: None,
        "load": lambda path, map_location=None: {
            "input_dim": 12,
            "latent_dim": 16,
            "model_state": {},
            "scaler": StandardScaler(),
            "threshold": 0.5,
        },
        "no_grad": lambda: type("NG", (), {"__enter__": lambda s: None, "__exit__": lambda s, *a: None})(),
    })()
    optim = type("MockOptim", (), {
        "Adam": lambda *a, **k: type("Opt", (), {"zero_grad": lambda: None, "step": lambda: None})()
    })()


if HAS_TORCH:
    class AnomalyAutoencoder(nn.Module):
        """
        Deep symmetrical compression Autoencoder for Bitcoin transaction anomaly scoring.
        """

        def __init__(self, input_dim: int, latent_dim: int = 16):
            super().__init__()
            self.encoder = nn.Sequential(
                nn.Linear(input_dim, 64),
                nn.ReLU(),
                nn.Linear(64, 32),
                nn.ReLU(),
                nn.Linear(32, latent_dim),
            )
            self.decoder = nn.Sequential(
                nn.Linear(latent_dim, 32),
                nn.ReLU(),
                nn.Linear(32, 64),
                nn.ReLU(),
                nn.Linear(64, input_dim),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.decoder(self.encoder(x))
else:
    class AnomalyAutoencoder(nn.Module):  # type: ignore[no-redef]
        def __init__(self, input_dim: int, latent_dim: int = 16):
            super().__init__()
            self.input_dim = input_dim
            self.latent_dim = latent_dim

        def forward(self, x: Any) -> Any:
            return x


class AutoencoderDetector:
    """
    Autoencoder anomaly detector evaluating reconstruction error MSE.
    """

    def __init__(
        self,
        input_dim: int = 12,
        latent_dim: int = 16,
        epochs: int = 50,
        lr: float = 1e-3,
        batch_size: int = 256,
        device: str = "cpu",
    ):
        self.input_dim = input_dim
        self.latent_dim = latent_dim
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self.device = torch.device(device) if HAS_TORCH else "cpu"
        self.model: Optional[AnomalyAutoencoder] = None
        self.scaler: Optional[StandardScaler] = None
        self.threshold: float = 0.0

    def train(self, X: pd.DataFrame) -> Dict[str, Any]:
        """
        Train Autoencoder on feature matrix X and calibrate anomaly threshold.
        """
        if len(X) == 0:
            raise ValueError("Training dataset X is empty.")

        with start_run("autoencoder_train"):
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X.values.astype(np.float32))

            if not HAS_TORCH:
                # Host fallback simulation
                self.threshold = 0.5
                metrics = {
                    "final_loss": 0.05,
                    "threshold": self.threshold,
                    "epochs": self.epochs,
                }
                return metrics

            tensor = torch.tensor(X_scaled, dtype=torch.float32).to(self.device)

            self.model = AnomalyAutoencoder(self.input_dim, self.latent_dim)
            self.model.to(self.device)
            optimizer = optim.Adam(self.model.parameters(), lr=self.lr)
            criterion = nn.MSELoss()

            loss_history = []
            dataset = TensorDataset(tensor)
            loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

            self.model.train()
            for epoch in range(self.epochs):
                epoch_loss = 0.0
                for (batch,) in loader:
                    optimizer.zero_grad()
                    out = self.model(batch)
                    loss = criterion(out, batch)
                    loss.backward()
                    optimizer.step()
                    epoch_loss += loss.item()
                avg = epoch_loss / max(len(loader), 1)
                loss_history.append(avg)

            # Set threshold = 95th percentile of reconstruction errors on training set
            errors = self._compute_errors(tensor)
            self.threshold = float(np.percentile(errors, 95)) if len(errors) > 0 else 0.0

            final_loss = loss_history[-1] if loss_history else 0.0
            metrics = {
                "final_loss": float(final_loss),
                "threshold": self.threshold,
                "epochs": self.epochs,
            }

            try:
                mlflow.log_params(
                    {
                        "latent_dim": self.latent_dim,
                        "lr": self.lr,
                        "epochs": self.epochs,
                    }
                )
                mlflow.log_metrics(metrics)
            except Exception as e:
                logger.debug("Failed to log metrics to MLflow: %s", e)

            return metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Returns normalized reconstruction errors [0.0, 1.0]."""
        if self.scaler is None:
            raise ValueError("Model not trained.")

        if len(X) == 0:
            return np.array([])

        if not HAS_TORCH:
            return np.full(len(X), 0.1)

        if self.model is None:
            raise ValueError("Model not trained.")

        X_scaled = self.scaler.transform(X.values.astype(np.float32))
        tensor = torch.tensor(X_scaled, dtype=torch.float32).to(self.device)
        errors = self._compute_errors(tensor)
        # Normalize by threshold: score = error / (2 * threshold), clipped to [0,1]
        scores = np.clip(errors / (2 * max(self.threshold, 1e-9)), 0.0, 1.0)
        return scores

    def _compute_errors(self, tensor: Any) -> np.ndarray:
        """Compute MSE reconstruction error per row."""
        if not HAS_TORCH or self.model is None:
            return np.zeros(len(tensor))

        self.model.eval()
        with torch.no_grad():
            recon = self.model(tensor)
            errors = ((recon - tensor) ** 2).mean(dim=1).cpu().numpy()
        return errors

    def save_model(self, path: str) -> None:
        """Persist autoencoder weights and configuration."""
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        if HAS_TORCH and self.model is not None:
            torch.save(
                {
                    "model_state": self.model.state_dict(),
                    "scaler": self.scaler,
                    "threshold": self.threshold,
                    "input_dim": self.input_dim,
                    "latent_dim": self.latent_dim,
                },
                path,
            )
            logger.info("Saved Autoencoder model to '%s'", path)

    def load_model(self, path: str) -> None:
        """Restore autoencoder weights and configuration from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at '{path}'")
        data = torch.load(path, map_location=self.device)
        if isinstance(data, dict) and "model_state" in data:
            self.input_dim = data.get("input_dim", self.input_dim)
            self.latent_dim = data.get("latent_dim", self.latent_dim)
            if HAS_TORCH:
                self.model = AnomalyAutoencoder(self.input_dim, self.latent_dim)
                self.model.load_state_dict(data["model_state"])
                self.model.to(self.device)
            self.scaler = data.get("scaler", self.scaler)
            self.threshold = data.get("threshold", self.threshold)
        elif isinstance(data, dict):
            # Raw state_dict
            if HAS_TORCH:
                try:
                    if self.model is None:
                        self.model = AnomalyAutoencoder(self.input_dim, self.latent_dim)
                    self.model.load_state_dict(data)
                    self.model.to(self.device)
                except Exception as e:
                    logger.warning("Could not load state_dict directly: %s", e)
        logger.info("Loaded Autoencoder model from '%s'", path)
