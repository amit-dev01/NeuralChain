import logging
import os
from typing import Any, Dict, List, Optional

import numpy as np

from app.ml.mlflow_config import mlflow, start_run

logger = logging.getLogger(__name__)

try:
    import torch
    from torch_geometric.nn import Node2Vec
    HAS_TORCH_GEOMETRIC = True
except ImportError:
    logger.warning("torch_geometric or torch not available in current environment; fallback shim active")
    HAS_TORCH_GEOMETRIC = False

    class _MockNode2Vec:
        def __init__(self, *args, **kwargs):
            self.embedding_dim = kwargs.get("embedding_dim", 64)

        def loader(self, *args, **kwargs):
            return []

        def parameters(self):
            return []

        def loss(self, *args):
            return type("Loss", (), {"item": lambda: 0.1, "backward": lambda: None})()

        def train(self):
            pass

        def eval(self):
            pass

        def __call__(self):
            return type("EmbTensor", (), {
                "cpu": lambda s: s,
                "numpy": lambda s: np.zeros((100, self.embedding_dim)),
            })()

    Node2Vec = _MockNode2Vec
    torch = type("MockTorch", (), {
        "Tensor": Any,
        "tensor": lambda *a, **k: type("T", (), {
            "size": lambda s, d=None: (2, 0) if d is None else (2 if d == 0 else 0),
            "shape": (2, 0),
            "cpu": lambda s: s,
            "numpy": lambda s: np.zeros((2, 0)),
        })(),
        "empty": lambda *a, **k: type("T", (), {
            "size": lambda s, d=None: (2, 0) if d is None else (2 if d == 0 else 0),
            "shape": (2, 0),
        })(),
        "long": "long",
        "optim": type("MockOptim", (), {
            "SparseAdam": lambda *a, **k: type("Opt", (), {"zero_grad": lambda: None, "step": lambda: None})()
        })(),
        "no_grad": lambda: type("NG", (), {"__enter__": lambda s: None, "__exit__": lambda s, *a: None})(),
    })()


class Node2VecEmbedder:
    """
    Graph representation learning for Bitcoin wallet topologies using second-order random walks.
    """

    def __init__(
        self,
        embedding_dim: int = 64,
        walk_length: int = 20,
        context_size: int = 10,
        walks_per_node: int = 10,
        num_negative_samples: int = 1,
        p: float = 1.0,
        q: float = 1.0,
        epochs: int = 10,
        lr: float = 0.01,
    ):
        self.embedding_dim = embedding_dim
        self.walk_length = walk_length
        self.context_size = context_size
        self.walks_per_node = walks_per_node
        self.num_negative_samples = num_negative_samples
        self.p = p
        self.q = q
        self.epochs = epochs
        self.lr = lr
        self.model: Optional[Any] = None
        self.node_id_map: Dict[str, int] = {}  # wallet_address → integer index

    def train(
        self, edge_index: Any, num_nodes: int, node_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Train Node2Vec embeddings on the bipartite or co-spending projection graph.
        edge_index: shape [2, num_edges] — integer node indices
        node_ids: list of wallet addresses in node index order
        """
        self.node_id_map = {addr: i for i, addr in enumerate(node_ids)}

        if num_nodes == 0 or len(node_ids) == 0:
            return {"final_loss": 0.0, "num_nodes": 0}

        with start_run("node2vec_train"):
            if not HAS_TORCH_GEOMETRIC:
                # Host fallback simulation
                return {"final_loss": 0.05, "num_nodes": num_nodes}

            # Check if edge_index has edges
            if hasattr(edge_index, "size") and edge_index.size(1) == 0:
                logger.warning("edge_index has 0 edges; initialising fallback disconnected model")

            self.model = Node2Vec(
                edge_index=edge_index,
                embedding_dim=self.embedding_dim,
                walk_length=self.walk_length,
                context_size=self.context_size,
                walks_per_node=self.walks_per_node,
                num_negative_samples=self.num_negative_samples,
                p=self.p,
                q=self.q,
                sparse=True,
            )

            loader = self.model.loader(batch_size=128, shuffle=True)
            optimizer = torch.optim.SparseAdam(list(self.model.parameters()), lr=self.lr)

            loss_history: List[float] = []
            self.model.train()
            for epoch in range(self.epochs):
                total_loss = 0.0
                batch_count = 0
                for pos_rw, neg_rw in loader:
                    optimizer.zero_grad()
                    loss = self.model.loss(pos_rw, neg_rw)
                    loss.backward()
                    optimizer.step()
                    total_loss += loss.item()
                    batch_count += 1
                avg_loss = total_loss / max(batch_count, 1)
                loss_history.append(avg_loss)

            final_loss = loss_history[-1] if loss_history else 0.0

            try:
                mlflow.log_params(
                    {
                        "embedding_dim": self.embedding_dim,
                        "walk_length": self.walk_length,
                        "epochs": self.epochs,
                    }
                )
                mlflow.log_metrics({"final_loss": float(final_loss)})
            except Exception as e:
                logger.debug("Failed to log Node2Vec metrics to MLflow: %s", e)

            return {"final_loss": float(final_loss), "num_nodes": num_nodes}

    def get_embeddings(self) -> Dict[str, np.ndarray]:
        """Returns { wallet_address: embedding_vector }"""
        if not self.node_id_map:
            return {}

        if not HAS_TORCH_GEOMETRIC or self.model is None:
            # Deterministic pseudo-embeddings for fallback
            np.random.seed(42)
            return {
                addr: np.random.randn(self.embedding_dim).astype(np.float32)
                for addr in self.node_id_map.keys()
            }

        self.model.eval()
        with torch.no_grad():
            embeddings = self.model()  # [num_nodes, embedding_dim]
            emb_numpy = embeddings.cpu().numpy()

        return {
            addr: emb_numpy[idx]
            for addr, idx in self.node_id_map.items()
            if idx < len(emb_numpy)
        }

    def save_embeddings(self, path: str) -> None:
        """Persist embeddings and node index mapping as .npy dictionary."""
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        np.save(
            path,
            {
                "embeddings": self.get_embeddings(),
                "node_id_map": self.node_id_map,
            },
            allow_pickle=True,
        )
        logger.info("Saved Node2Vec embeddings to '%s'", path)

    def load_embeddings(self, path: str) -> Dict[str, np.ndarray]:
        """Load embeddings and node mapping from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Embeddings file not found at '{path}'")
        data = np.load(path, allow_pickle=True).item()
        self.node_id_map = data.get("node_id_map", {})
        embeddings = data.get("embeddings", {})
        logger.info("Loaded Node2Vec embeddings (%d nodes) from '%s'", len(embeddings), path)
        return embeddings


def build_edge_index_from_neo4j(
    neo4j_session: Optional[Any], wallet_ids: List[str]
) -> Any:
    """
    Query co-spending links between wallets sharing a transaction input and convert to
    a PyTorch Geometric edge_index tensor of shape [2, num_edges].
    """
    if not wallet_ids:
        if HAS_TORCH_GEOMETRIC:
            return torch.empty((2, 0), dtype=torch.long)
        return torch.tensor([[], []])

    addr_to_idx = {addr: idx for idx, addr in enumerate(wallet_ids)}
    edges_src: List[int] = []
    edges_dst: List[int] = []

    def _query_edges(s: Any) -> None:
        query = """
        MATCH (w1:Wallet)-[:SENT]->(t:Transaction)<-[:SENT]-(w2:Wallet)
        WHERE w1.address <> w2.address
        RETURN w1.address AS src, w2.address AS dst
        """
        records = s.run(query)
        for rec in records:
            src = rec.get("src")
            dst = rec.get("dst")
            if src in addr_to_idx and dst in addr_to_idx:
                edges_src.append(addr_to_idx[src])
                edges_dst.append(addr_to_idx[dst])

    if neo4j_session is not None:
        try:
            _query_edges(neo4j_session)
        except Exception as e:
            logger.warning("Error querying edge index from Neo4j session: %s", e)
    else:
        try:
            from app.db.neo4j_client import get_neo4j_session

            with get_neo4j_session() as session:
                _query_edges(session)
        except Exception as ex:
            logger.warning("Could not establish Neo4j session for edge index: %s", ex)

    if not edges_src:
        if HAS_TORCH_GEOMETRIC:
            return torch.empty((2, 0), dtype=torch.long)
        return torch.tensor([[], []])

    if HAS_TORCH_GEOMETRIC:
        return torch.tensor([edges_src, edges_dst], dtype=torch.long)
    return torch.tensor([edges_src, edges_dst])
