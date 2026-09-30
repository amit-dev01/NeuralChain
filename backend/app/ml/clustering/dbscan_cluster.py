import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import normalize
from sqlalchemy.orm import Session

from app.db.postgres import Entity

logger = logging.getLogger(__name__)


def cluster(
    embeddings: Dict[str, np.ndarray],
    eps: float = 0.5,
    min_samples: int = 3,
) -> Dict[str, int]:
    """
    Cluster wallet embedding vectors using DBSCAN with cosine distance metric.
    Returns { wallet_address: cluster_id }, where -1 designates noise.
    """
    if not embeddings:
        return {}

    wallet_ids = list(embeddings.keys())
    if len(wallet_ids) < min_samples:
        # Not enough samples to form clusters
        return {w: -1 for w in wallet_ids}

    matrix = np.array([embeddings[w] for w in wallet_ids], dtype=np.float32)
    matrix = normalize(matrix, norm="l2")

    dbscan = DBSCAN(
        eps=eps,
        min_samples=min_samples,
        metric="cosine",
        n_jobs=-1,
    )
    labels = dbscan.fit_predict(matrix)

    result = {wallet_ids[i]: int(labels[i]) for i in range(len(labels))}

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = int((labels == -1).sum())
    logger.info("DBSCAN: %d clusters, %d noise points among %d wallets", n_clusters, n_noise, len(wallet_ids))

    return result


def write_clusters_to_neo4j(
    cluster_map: Dict[str, int],
    neo4j_session: Optional[Any] = None,
) -> None:
    """
    Persist cluster ID assignments back into Neo4j Wallet nodes in batches of 500.
    """
    if not cluster_map:
        return

    items: List[Dict[str, Any]] = [
        {"address": str(k), "cluster_id": int(v)} for k, v in cluster_map.items()
    ]
    batch_size = 500
    cypher = """
    UNWIND $updates AS u
    MATCH (w:Wallet {address: u.address})
    SET w.cluster_id = u.cluster_id
    """

    def _execute(s: Any) -> None:
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            s.run(cypher, {"updates": batch})
        logger.info("Wrote %d wallet cluster assignments to Neo4j", len(items))

    if neo4j_session is not None:
        try:
            _execute(neo4j_session)
            return
        except Exception as e:
            logger.warning("Error writing clusters to provided Neo4j session: %s", e)

    try:
        from app.db.neo4j_client import get_neo4j_session

        with get_neo4j_session() as session:
            _execute(session)
    except Exception as ex:
        logger.warning("Failed to write clusters to Neo4j: %s", ex)


def write_clusters_to_postgres(
    cluster_map: Dict[str, int],
    dataset_id: str,
    db: Session,
) -> None:
    """
    Upsert cluster IDs into the PostgreSQL Entity table for persistent analytical lookup.
    """
    if not cluster_map:
        return

    wallet_addrs = list(cluster_map.keys())
    chunk_size = 500

    for i in range(0, len(wallet_addrs), chunk_size):
        chunk = wallet_addrs[i : i + chunk_size]
        existing_entities = {
            e.wallet_address: e
            for e in db.query(Entity).filter(Entity.wallet_address.in_(chunk)).all()
        }

        for addr in chunk:
            c_id = cluster_map[addr]
            if addr in existing_entities:
                existing_entities[addr].cluster_id = c_id
            else:
                new_ent = Entity(
                    id=uuid.uuid4(),
                    wallet_address=addr,
                    cluster_id=c_id,
                    risk_score=0.0,
                    tx_count=0,
                    created_at=datetime.utcnow(),
                )
                db.add(new_ent)

        db.commit()

    logger.info("Wrote %d wallet cluster assignments to PostgreSQL entities", len(cluster_map))
