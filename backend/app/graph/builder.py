import logging
from typing import Any, Dict, List, Optional

from app.ingest.models import TransactionRecord

logger = logging.getLogger(__name__)


def _batch_write(tx: Any, records_batch: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Execute parameterized MERGE Cypher queries for a single batch of transaction records.
    Returns: { "nodes_created": int, "edges_created": int }
    """
    if not records_batch:
        return {"nodes_created": 0, "edges_created": 0}

    # Query 1: Merge Transactions, Wallets, and SENT / RECEIVED edges
    cypher_tx_wallets = """
    UNWIND $batch AS r
    MERGE (t:Transaction {txid: r.txid})
    ON CREATE SET t.timestamp = r.timestamp,
                  t.fee = r.fee,
                  t.total_input = r.total_input,
                  t.total_output = r.total_output,
                  t.fan_in = r.fan_in,
                  t.fan_out = r.fan_out,
                  t.script_type = r.script_type,
                  t.dataset_id = r.dataset_id

    WITH r, t
    FOREACH (addr IN r.input_addresses |
      MERGE (w:Wallet {address: addr})
      ON CREATE SET w.first_seen = r.timestamp,
                    w.dataset_id = r.dataset_id,
                    w.tx_count = 1
      ON MATCH SET w.last_seen = r.timestamp,
                   w.tx_count = w.tx_count + 1
      MERGE (w)-[:SENT]->(t)
    )

    FOREACH (addr IN r.output_addresses |
      MERGE (w:Wallet {address: addr})
      ON CREATE SET w.first_seen = r.timestamp,
                    w.dataset_id = r.dataset_id,
                    w.tx_count = 1
      ON MATCH SET w.last_seen = r.timestamp,
                   w.tx_count = w.tx_count + 1
      MERGE (t)-[:RECEIVED]->(w)
    )
    """

    # Query 2: Merge IP, Country, ASN nodes and CONNECTED_FROM / BELONGS_TO edges
    cypher_ip_telemetry = """
    UNWIND $batch AS r
    WITH r WHERE r.src_ip IS NOT NULL AND r.src_ip <> ""
    MERGE (ip:IP {address: r.src_ip})
    ON CREATE SET ip.country = r.country,
                  ip.asn = r.asn,
                  ip.city = r.city,
                  ip.lat = r.lat,
                  ip.lon = r.lon

    WITH r, ip
    MATCH (t:Transaction {txid: r.txid})
    MERGE (ip)-[:CONNECTED_FROM]->(t)

    WITH r, ip
    FOREACH (c_code IN CASE WHEN r.country IS NOT NULL AND r.country <> "" THEN [r.country] ELSE [] END |
      MERGE (c:Country {code: c_code})
      MERGE (ip)-[:BELONGS_TO]->(c)
    )

    FOREACH (asn_id IN CASE WHEN r.asn IS NOT NULL AND r.asn <> "" THEN [r.asn] ELSE [] END |
      MERGE (a:ASN {id: asn_id})
      MERGE (ip)-[:BELONGS_TO]->(a)
    )
    """

    res1 = tx.run(cypher_tx_wallets, {"batch": records_batch})
    sum1 = res1.consume()

    res2 = tx.run(cypher_ip_telemetry, {"batch": records_batch})
    sum2 = res2.consume()

    nodes = sum1.counters.nodes_created + sum2.counters.nodes_created
    edges = sum1.counters.relationships_created + sum2.counters.relationships_created

    return {"nodes_created": nodes, "edges_created": edges}


def build_graph_from_transactions(
    records: List[TransactionRecord],
    dataset_id: str = "",
    session: Optional[Any] = None,
) -> Dict[str, int]:
    """
    Ingest a collection of TransactionRecords into Neo4j graph nodes and relationships in batches of 500.
    Returns: { "nodes_created": int, "edges_created": int }
    """
    if not records:
        return {"nodes_created": 0, "edges_created": 0}

    # Normalize records to dictionary format
    serialized_records: List[Dict[str, Any]] = []
    for r in records:
        if isinstance(r, dict):
            r_dict = r
            r_txid = str(r_dict.get("txid", ""))
            r_ts = r_dict.get("timestamp")
            r_fee = float(r_dict.get("fee", 0.0) or 0.0)
            in_addrs = list(r_dict.get("input_addresses") or [])
            out_addrs = list(r_dict.get("output_addresses") or [])
            in_amts = [float(x) for x in r_dict.get("input_amounts") or []]
            out_amts = [float(x) for x in r_dict.get("output_amounts") or []]
            s_type = str(r_dict.get("script_type") or "UNKNOWN")
            src_ip = r_dict.get("src_ip")
            country = r_dict.get("geo_country")
            asn = r_dict.get("asn")
            city = r_dict.get("city")
            lat = float(r_dict["lat"]) if r_dict.get("lat") is not None else None
            lon = float(r_dict["lon"]) if r_dict.get("lon") is not None else None
            d_id = str(r_dict.get("dataset_id") or dataset_id or "")
        else:
            r_txid = str(r.txid)
            r_ts = r.timestamp
            r_fee = float(r.fee or 0.0)
            in_addrs = list(r.input_addresses or [])
            out_addrs = list(r.output_addresses or [])
            in_amts = [float(x) for x in r.input_amounts or []]
            out_amts = [float(x) for x in r.output_amounts or []]
            s_type = r.script_type.value if hasattr(r.script_type, "value") else str(r.script_type)
            src_ip = r.src_ip
            country = r.geo_country
            asn = r.asn
            city = r.city
            lat = float(r.lat) if r.lat is not None else None
            lon = float(r.lon) if r.lon is not None else None
            d_id = str(dataset_id or "")

        ts_str = r_ts.isoformat() if hasattr(r_ts, "isoformat") else str(r_ts)
        serialized_records.append(
            {
                "txid": r_txid,
                "timestamp": ts_str,
                "fee": r_fee,
                "total_input": sum(in_amts) if in_amts else 0.0,
                "total_output": sum(out_amts) if out_amts else 0.0,
                "fan_in": len(in_addrs),
                "fan_out": len(out_addrs),
                "script_type": s_type,
                "dataset_id": d_id,
                "input_addresses": in_addrs,
                "output_addresses": out_addrs,
                "src_ip": src_ip if src_ip else None,
                "country": country if country else None,
                "asn": asn if asn else None,
                "city": city if city else None,
                "lat": lat,
                "lon": lon,
            }
        )

    def _execute_in_session(s: Any) -> Dict[str, int]:
        total_nodes = 0
        total_edges = 0
        batch_size = 500

        for i in range(0, len(serialized_records), batch_size):
            batch = serialized_records[i : i + batch_size]
            try:
                if hasattr(s, "execute_write"):
                    res = s.execute_write(lambda tx: _batch_write(tx, batch))
                elif hasattr(s, "write_transaction"):
                    res = s.write_transaction(lambda tx: _batch_write(tx, batch))
                else:
                    res = _batch_write(s, batch)
                total_nodes += res.get("nodes_created", 0)
                total_edges += res.get("edges_created", 0)
            except Exception as e:
                logger.warning("Batch write failed in Neo4j at offset %d: %s", i, e)

        return {"nodes_created": total_nodes, "edges_created": total_edges}

    if session is not None:
        return _execute_in_session(session)

    try:
        from app.db.neo4j_client import get_neo4j_session

        with get_neo4j_session() as active_session:
            return _execute_in_session(active_session)
    except Exception as ex:
        logger.warning("Could not obtain Neo4j session for graph building: %s", ex)
        return {"nodes_created": 0, "edges_created": 0}


def delete_dataset_graph(dataset_id: str, session: Optional[Any] = None) -> None:
    """Delete all graph nodes and detached relationships associated with a dataset_id."""
    cypher = "MATCH (n {dataset_id: $dataset_id}) DETACH DELETE n"
    params = {"dataset_id": str(dataset_id)}

    def _run_delete(s: Any) -> None:
        s.run(cypher, params)

    if session is not None:
        _run_delete(session)
        return

    try:
        from app.db.neo4j_client import get_neo4j_session

        with get_neo4j_session() as active_session:
            _run_delete(active_session)
    except Exception as e:
        logger.warning("Failed to delete dataset graph for %s: %s", dataset_id, e)
