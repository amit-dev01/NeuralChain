import logging
from typing import Any, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

CLUSTER_FEATURE_COLUMNS: List[str] = [
    "degree",
    "out_degree",
    "in_degree",
    "common_input_count",
]


def extract_graph_features(neo4j_session: Optional[Any] = None) -> pd.DataFrame:
    """
    Extract graph topological metrics per wallet address from Neo4j.
    Computes degree, out_degree, in_degree, and common_input_count.
    Returns DataFrame: [wallet_id, degree, out_degree, in_degree, common_input_count]
    """
    cols = ["wallet_id"] + CLUSTER_FEATURE_COLUMNS

    def _run_queries(s: Any) -> pd.DataFrame:
        # 1. Total Degree per wallet
        q1 = """
        MATCH (w:Wallet)-[r]-()
        RETURN w.address AS wallet_id, count(r) AS degree
        """
        r1 = s.run(q1)
        df1 = pd.DataFrame([dict(rec) for rec in r1], columns=["wallet_id", "degree"])

        # 2. Out-degree (sent)
        q2 = """
        MATCH (w:Wallet)-[:SENT]->(t)
        RETURN w.address AS wallet_id, count(t) AS out_degree
        """
        r2 = s.run(q2)
        df2 = pd.DataFrame([dict(rec) for rec in r2], columns=["wallet_id", "out_degree"])

        # 3. In-degree (received)
        q3 = """
        MATCH (w:Wallet)<-[:RECEIVED]-(t)
        RETURN w.address AS wallet_id, count(t) AS in_degree
        """
        r3 = s.run(q3)
        df3 = pd.DataFrame([dict(rec) for rec in r3], columns=["wallet_id", "in_degree"])

        # 4. Common input count (wallets sharing input co-spending transactions)
        q4 = """
        MATCH (w:Wallet)-[:SENT]->(t:Transaction)<-[:SENT]-(other:Wallet)
        WHERE w.address <> other.address
        RETURN w.address AS wallet_id, count(DISTINCT other) AS common_input_count
        """
        r4 = s.run(q4)
        df4 = pd.DataFrame([dict(rec) for rec in r4], columns=["wallet_id", "common_input_count"])

        # Collect unique wallets
        wallets_set = set()
        for df in (df1, df2, df3, df4):
            if not df.empty and "wallet_id" in df.columns:
                wallets_set.update(df["wallet_id"].dropna().tolist())

        if not wallets_set:
            return pd.DataFrame(columns=cols)

        base_df = pd.DataFrame({"wallet_id": list(wallets_set)})

        merged = base_df.merge(df1, on="wallet_id", how="left")
        merged = merged.merge(df2, on="wallet_id", how="left")
        merged = merged.merge(df3, on="wallet_id", how="left")
        merged = merged.merge(df4, on="wallet_id", how="left")

        for col in CLUSTER_FEATURE_COLUMNS:
            merged[col] = merged[col].fillna(0).astype(float)

        return merged[cols]

    if neo4j_session is not None:
        try:
            return _run_queries(neo4j_session)
        except Exception as e:
            logger.warning("Error querying graph features from provided Neo4j session: %s", e)
            return pd.DataFrame(columns=cols)

    try:
        from app.db.neo4j_client import get_neo4j_session

        with get_neo4j_session() as session:
            return _run_queries(session)
    except Exception as ex:
        logger.warning("Could not establish Neo4j session for graph feature extraction: %s", ex)
        return pd.DataFrame(columns=cols)
