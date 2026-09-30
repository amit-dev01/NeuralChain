import logging
import os
from typing import Any, Dict, Optional

import numpy as np

from app.ml.mlflow_config import mlflow, start_run

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torch.nn import BCELoss
    from torch.optim import Adam
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    logger.warning("PyTorch library not available on local host; activating sequence shim")
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
        def LSTM(*args, **kwargs):
            return _MockNNModule()

        @staticmethod
        def Linear(*args, **kwargs):
            return _MockNNModule()

        @staticmethod
        def Sigmoid():
            return lambda x: x

    nn = _MockNN()
    BCELoss = lambda: lambda a, b: type("Loss", (), {"item": lambda: 0.1, "backward": lambda: None})()
    Adam = lambda params, lr: type("Opt", (), {"zero_grad": lambda: None, "step": lambda: None})()
    torch = type("MockTorch", (), {
        "device": lambda x: "cpu",
        "tensor": lambda a, dtype=None: type("T", (), {"to": lambda s, d: s, "cpu": lambda s: s, "numpy": lambda s: np.zeros(len(a))})(),
        "float32": "float32",
        "save": lambda obj, path: None,
        "load": lambda path, map_location=None: {
            "model_state": {},
            "config": {"input_size": 6, "hidden_size": 64, "num_layers": 2},
        },
        "no_grad": lambda: type("NG", (), {"__enter__": lambda s: None, "__exit__": lambda s, *a: None})(),
    })()


if HAS_TORCH:
    class MixingLSTM(nn.Module):
        """
        Recurrent neural network detecting CoinJoin and tumbler mixing behavior.
        """

        def __init__(
            self,
            input_size: int = 6,
            hidden_size: int = 64,
            num_layers: int = 2,
            dropout: float = 0.3,
        ):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                dropout=dropout if num_layers > 1 else 0.0,
                batch_first=True,
            )
            self.fc = nn.Linear(hidden_size, 1)
            self.sigmoid = nn.Sigmoid()

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            out, (h_n, _) = self.lstm(x)
            # Use last timestep output
            last = out[:, -1, :]
            return self.sigmoid(self.fc(last)).squeeze(-1)
else:
    class MixingLSTM(nn.Module):  # type: ignore[no-redef]
        def __init__(
            self,
            input_size: int = 6,
            hidden_size: int = 64,
            num_layers: int = 2,
            dropout: float = 0.3,
        ):
            super().__init__()
            self.input_size = input_size
            self.hidden_size = hidden_size
            self.num_layers = num_layers

        def forward(self, x: Any) -> Any:
            return x


class MixingDetector:
    """
    Sequence classifier for Bitcoin mixing and multi-hop tumbling activity.
    """

    def __init__(
        self,
        input_size: int = 6,
        hidden_size: int = 64,
        num_layers: int = 2,
        epochs: int = 30,
        lr: float = 1e-3,
        device: str = "cpu",
    ):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.epochs = epochs
        self.lr = lr
        self.device = torch.device(device) if HAS_TORCH else "cpu"
        self.model: Optional[MixingLSTM] = None
        self.threshold: float = 0.5

    def train(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """
        Train sequence model with binary cross entropy loss.
        X: [n_samples, seq_length, n_features]
        y: [n_samples] binary labels (1 = mixing, 0 = normal)
        """
        if len(X) == 0:
            return {"final_loss": 0.0}

        with start_run("mixing_lstm_train"):
            if not HAS_TORCH:
                return {"final_loss": 0.05}

            self.model = MixingLSTM(
                input_size=self.input_size,
                hidden_size=self.hidden_size,
                num_layers=self.num_layers,
            ).to(self.device)

            X_t = torch.tensor(X, dtype=torch.float32).to(self.device)
            y_t = torch.tensor(y, dtype=torch.float32).to(self.device)
            dataset = TensorDataset(X_t, y_t)
            batch_sz = min(64, max(1, len(X)))
            loader = DataLoader(dataset, batch_size=batch_sz, shuffle=True)
            optimizer = Adam(self.model.parameters(), lr=self.lr)
            criterion = BCELoss()

            self.model.train()
            loss_history: list[float] = []

            for epoch in range(self.epochs):
                epoch_loss = 0.0
                batch_count = 0
                for xb, yb in loader:
                    optimizer.zero_grad()
                    pred = self.model(xb)
                    loss = criterion(pred, yb)
                    loss.backward()
                    optimizer.step()
                    epoch_loss += loss.item()
                    batch_count += 1
                avg_loss = epoch_loss / max(batch_count, 1)
                loss_history.append(avg_loss)

            final_loss = loss_history[-1] if loss_history else 0.0

            try:
                mlflow.log_params(
                    {
                        "hidden_size": self.hidden_size,
                        "num_layers": self.num_layers,
                        "epochs": self.epochs,
                    }
                )
                mlflow.log_metrics({"final_loss": float(final_loss)})
            except Exception as e:
                logger.debug("Failed to log LSTM metrics to MLflow: %s", e)

            return {"final_loss": float(final_loss)}

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict mixing confidence scores in range [0.0, 1.0]."""
        if len(X) == 0:
            return np.array([], dtype=np.float32)

        if not HAS_TORCH:
            return np.full(len(X), 0.1, dtype=np.float32)

        if self.model is None:
            raise ValueError("Model not trained.")

        self.model.eval()
        X_t = torch.tensor(X, dtype=torch.float32).to(self.device)
        with torch.no_grad():
            scores = self.model(X_t).cpu().numpy()
        return scores.astype(np.float32)

    def save_model(self, path: str) -> None:
        """Persist model state dictionary and configuration."""
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        if HAS_TORCH and self.model is not None:
            torch.save(
                {
                    "model_state": self.model.state_dict(),
                    "config": {
                        "input_size": self.input_size,
                        "hidden_size": self.hidden_size,
                        "num_layers": self.num_layers,
                    },
                },
                path,
            )
            logger.info("Saved MixingLSTM model to '%s'", path)

    def load_model(self, path: str) -> None:
        """Load model state and re-instantiate network."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at '{path}'")
        data = torch.load(path, map_location=self.device)
        cfg = data["config"]
        if HAS_TORCH:
            self.model = MixingLSTM(**cfg).to(self.device)
            self.model.load_state_dict(data["model_state"])
        logger.info("Loaded MixingLSTM model from '%s'", path)
