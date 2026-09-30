import logging
import uuid
from typing import Any, Dict, List

from app.celery_app import celery_app
from app.db.postgres import SessionLocal, Transaction
from app.ml.clustering.dbscan_cluster import (
    cluster,
    write_clusters_to_neo4j,
    write_clusters_to_postgres,
)
from app.ml.clustering.features import extract_graph_features
from app.ml.clustering.node2vec_model import (
    Node2VecEmbedder,
    build_edge_index_from_neo4j,
)
from app.ml.model_registry import register_model_run, update_model_run

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="ml.run_clustering")
def run_clustering_task(self, dataset_id: str) -> Dict[str, Any]:
    """
    Celery task executing unsupervised wallet entity clustering using Node2Vec graph embeddings
    and DBSCAN density grouping.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info("Executing run_clustering_task %s for dataset %s", task_id, dataset_id)

    db = SessionLocal()
    try:
        register_model_run(
            model_name="node2vec_dbscan",
            task_id=task_id,
            dataset_id=dataset_id,
            db=db,
        )

        wallet_ids: List[str] = []

        # 1. Load wallet list from Neo4j
        try:
            from app.db.neo4j_client import get_neo4j_session

            with get_neo4j_session() as session:
                result = session.run("MATCH (w:Wallet) RETURN w.address AS address")
                wallet_ids = [rec["address"] for rec in result if rec.get("address")]

                # 2. Extract graph topological features
                features_df = extract_graph_features(session)

                # 3. Build edge_index from co-spending paths
                edge_index = build_edge_index_from_neo4j(session, wallet_ids)
        except Exception as e:
            logger.warning("Neo4j graph access failed during clustering task: %s", e)
            features_df = None
            edge_index = None

        # Fallback to postgres transactions if Neo4j returned no wallets
        if not wallet_ids:
            parsed_ds_uuid = None
            try:
                parsed_ds_uuid = uuid.UUID(str(dataset_id))
            except Exception:
                pass

            tx_q = db.query(Transaction)
            if parsed_ds_uuid:
                tx_q = tx_q.filter(Transaction.dataset_id == parsed_ds_uuid)

            txs = tx_q.all()
            w_set = set()
            for t in txs:
                if t.input_addresses:
                    w_set.update(t.input_addresses)
                if t.output_addresses:
                    w_set.update(t.output_addresses)
            wallet_ids = list(w_set)

        if not wallet_ids:
            logger.info("No wallets found to cluster for dataset %s", dataset_id)
            metrics = {"n_clusters": 0, "n_noise": 0, "n_wallets": 0}
            update_model_run(task_id=task_id, status="complete", metrics=metrics, db=db)
            return metrics

        # 4. Train Node2Vec embedder
        embedder = Node2VecEmbedder(
            embedding_dim=32,
            walk_length=10,
            context_size=5,
            walks_per_node=5,
            epochs=5,
        )
        if edge_index is None:
            # Fallback disconnected tensor
            import torch
            try:
                edge_index = torch.empty((2, 0), dtype=torch.long)
            except Exception:
                edge_index = [[], []]

        embedder.train(edge_index, num_nodes=len(wallet_ids), node_ids=wallet_ids)

        # 5. Get embeddings dict
        embeddings = embedder.get_embeddings()

        # 6. Run DBSCAN clustering
        cluster_map = cluster(embeddings, eps=0.5, min_samples=3)

        # 7. Write clusters to Neo4j + Postgres
        try:
            write_clusters_to_neo4j(cluster_map)
        except Exception as ne:
            logger.warning("Failed writing clusters to Neo4j: %s", ne)

        write_clusters_to_postgres(cluster_map, dataset_id, db)

        labels = list(cluster_map.values())
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = int(sum(1 for l in labels if l == -1))
        metrics = {
            "n_clusters": n_clusters,
            "n_noise": n_noise,
            "n_wallets": len(wallet_ids),
        }

        # 8. Register model run completion
        update_model_run(task_id=task_id, status="complete", metrics=metrics, db=db)
        logger.info("Clustering completed for dataset %s: %s", dataset_id, metrics)
        return metrics

    except Exception as e:
        logger.exception("Error executing run_clustering_task for dataset %s: %s", dataset_id, e)
        update_model_run(
            task_id=task_id,
            status="failed",
            metrics={"error": str(e)},
            db=db,
        )
        raise e
    finally:
        db.close()
