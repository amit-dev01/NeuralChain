import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from app.db.neo4j_client import get_neo4j_session
from app.db.postgres import Alert, Entity, Transaction, get_db
from app.graph.queries import (
    get_ego_graph,
    get_fan_out_transactions,
    get_peel_chains,
    get_shortest_path,
)
from app.graph.serializer import neo4j_result_to_graph_json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["graph"])


def _build_graph_from_postgres(db: Session, target_wallet: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    """Build real graph topology directly from PostgreSQL transactions ledger."""
    query = db.query(Transaction)
    if target_wallet:
        query = query.filter(
            or_(
                cast(Transaction.input_addresses, String).contains(target_wallet),
                cast(Transaction.output_addresses, String).contains(target_wallet),
            )
        )
    txs = query.order_by(Transaction.timestamp.desc()).limit(limit).all()
    if not txs:
        return {"nodes": [], "links": []}

    alerts = db.query(Alert).all()
    alert_map = {a.wallet_id: float(a.risk_score) for a in alerts}
    entities = db.query(Entity).all()
    entity_map = {e.wallet_address: e for e in entities}

    nodes = {}
    links = []

    for tx in txs:
        tx_id = f"tx_{tx.txid[:16]}"
        nodes[tx_id] = {
            "id": tx_id,
            "type": "transaction",
            "label": f"{tx.txid[:8]}...",
            "fullLabel": tx.txid,
            "fee": tx.fee,
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
            "risk": 0.25,
        }

        # Input wallets
        in_addrs = tx.input_addresses if isinstance(tx.input_addresses, list) else []
        for in_addr in in_addrs[:4]:
            if not in_addr:
                continue
            w_id = str(in_addr)
            if w_id not in nodes:
                ent = entity_map.get(w_id)
                risk = alert_map.get(w_id, float(ent.risk_score) if ent else (0.45 if w_id == target_wallet else 0.20))
                nodes[w_id] = {
                    "id": w_id,
                    "type": "wallet",
                    "label": f"{w_id[:10]}...",
                    "fullLabel": w_id,
                    "risk": round(risk, 3),
                    "cluster": ent.cluster_id if (ent and ent.cluster_id) else 1,
                    "totalSent": ent.total_sent if ent else 0.0,
                    "totalReceived": ent.total_received if ent else 0.0,
                    "txCount": ent.tx_count if ent else 1,
                    "entityLabel": ent.entity_label if ent else ("Target Subject" if w_id == target_wallet else "Monitored Wallet"),
                }
            links.append({
                "source": w_id,
                "target": tx_id,
                "type": "SENT",
            })

        # Output wallets
        out_addrs = tx.output_addresses if isinstance(tx.output_addresses, list) else []
        for out_addr in out_addrs[:4]:
            if not out_addr:
                continue
            w_id = str(out_addr)
            if w_id not in nodes:
                ent = entity_map.get(w_id)
                risk = alert_map.get(w_id, float(ent.risk_score) if ent else (0.35 if w_id == target_wallet else 0.15))
                nodes[w_id] = {
                    "id": w_id,
                    "type": "wallet",
                    "label": f"{w_id[:10]}...",
                    "fullLabel": w_id,
                    "risk": round(risk, 3),
                    "cluster": ent.cluster_id if (ent and ent.cluster_id) else 2,
                    "totalSent": ent.total_sent if ent else 0.0,
                    "totalReceived": ent.total_received if ent else 0.0,
                    "txCount": ent.tx_count if ent else 1,
                    "entityLabel": ent.entity_label if ent else ("Target Subject" if w_id == target_wallet else "Monitored Wallet"),
                }
            links.append({
                "source": tx_id,
                "target": w_id,
                "type": "RECEIVED",
            })

    return {
        "nodes": list(nodes.values()),
        "links": links,
    }


@router.get(
    "/nodes",
    summary="Query ego-network graph centered on a starting wallet address",
)
def get_graph_nodes(
    start: Optional[str] = Query(None, description="Target starting wallet address"),
    depth: int = Query(2, ge=1, le=4, description="Graph traversal search radius (1-4)"),
    risk_min: float = Query(0.0, ge=0.0, description="Minimum risk score filter"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve ego graph nodes and links, filtered by risk threshold."""
    graph_data = {"nodes": [], "links": []}

    # 1. Try Neo4j graph first
    try:
        with get_neo4j_session() as session:
            if start:
                cypher, params = get_ego_graph(wallet_id=start, depth=depth)
            else:
                cypher = "MATCH path = (w:Wallet)-[r]->(t:Transaction) RETURN path LIMIT 60"
                params = {}
            result = session.run(cypher, params)
            records = list(result)
            if records:
                graph_data = neo4j_result_to_graph_json(records)
    except Exception as e:
        logger.info("Neo4j query skipped or empty (%s), using PostgreSQL ledger...", e)

    # 2. Fallback to real PostgreSQL transaction topology if Neo4j returned nothing
    if not graph_data or not graph_data.get("nodes"):
        graph_data = _build_graph_from_postgres(db, target_wallet=start, limit=40)

    # Filter nodes by minimum risk threshold
    nodes = [
        n for n in graph_data.get("nodes", []) if float(n.get("risk", n.get("risk_score", 0.0)) or 0.0) >= risk_min
    ]
    valid_ids = {n["id"] for n in nodes}
    links = [
        l for l in graph_data.get("links", []) if l["source"] in valid_ids and l["target"] in valid_ids
    ]

    return {
        "nodes": nodes,
        "links": links,
        "meta": {
            "node_count": len(nodes),
            "link_count": len(links),
        },
    }


@router.get(
    "/subgraph/{wallet_id}",
    summary="Retrieve default 2-hop subgraph for an individual wallet",
)
def get_wallet_subgraph(wallet_id: str) -> Dict[str, Any]:
    """Retrieve 2-hop ego network for the specified wallet without risk filtering."""
    cypher, params = get_ego_graph(wallet_id=wallet_id, depth=2)

    try:
        with get_neo4j_session() as session:
            result = session.run(cypher, params)
            records = list(result)
            graph_data = neo4j_result_to_graph_json(records)
    except Exception as e:
        logger.warning("Neo4j query error on /subgraph for %s: %s", wallet_id, e)
        return {
            "nodes": [],
            "links": [],
            "meta": {"node_count": 0, "link_count": 0, "message": str(e)},
        }

    return {
        "nodes": graph_data["nodes"],
        "links": graph_data["links"],
        "meta": {
            "node_count": len(graph_data["nodes"]),
            "link_count": len(graph_data["links"]),
        },
    }


@router.get(
    "/shortest-path",
    summary="Calculate shortest graph transaction path between two wallets",
)
def get_wallet_shortest_path(
    from_wallet: str = Query(..., description="Origin wallet address"),
    to_wallet: str = Query(..., description="Destination wallet address"),
) -> Dict[str, Any]:
    """Find the shortest connecting transaction and entity path between two wallets."""
    cypher, params = get_shortest_path(from_wallet, to_wallet)

    try:
        with get_neo4j_session() as session:
            result = session.run(cypher, params)
            records = list(result)
            if not records:
                return {
                    "nodes": [],
                    "links": [],
                    "message": "No path found",
                }
            graph_data = neo4j_result_to_graph_json(records)
            if not graph_data["nodes"]:
                return {
                    "nodes": [],
                    "links": [],
                    "message": "No path found",
                }
            return {
                "nodes": graph_data["nodes"],
                "links": graph_data["links"],
            }
    except Exception as e:
        logger.warning("Error finding shortest path between %s and %s: %s", from_wallet, to_wallet, e)
        return {
            "nodes": [],
            "links": [],
            "message": "No path found",
        }


@router.get(
    "/stats",
    summary="Get aggregated graph statistics, node label counts, and community clusters",
)
def get_graph_statistics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve comprehensive graph counts across Neo4j entity types and PostgreSQL cluster communities."""
    node_types: Dict[str, int] = {}
    edge_types: Dict[str, int] = {}
    total_nodes = 0
    total_edges = 0

    try:
        with get_neo4j_session() as session:
            # 1. Node count by label
            res_nodes = session.run("MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count")
            for rec in res_nodes:
                n_type = rec["type"] or "Unknown"
                cnt = int(rec["count"])
                node_types[n_type] = cnt
                total_nodes += cnt

            # 2. Edge count by relationship type
            res_edges = session.run("MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count")
            for rec in res_edges:
                r_type = rec["type"] or "Unknown"
                cnt = int(rec["count"])
                edge_types[r_type] = cnt
                total_edges += cnt
    except Exception as e:
        logger.warning("Failed to collect Neo4j graph stats: %s", e)

    # 3. Community count from Entity table in PostgreSQL
    community_count = 0
    try:
        count_val = (
            db.query(func.count(func.distinct(Entity.cluster_id)))
            .filter(Entity.cluster_id.isnot(None))
            .scalar()
        )
        community_count = int(count_val or 0)
    except Exception as pe:
        logger.debug("Could not query Entity community count from PostgreSQL: %s", pe)

    return {
        "node_count": total_nodes,
        "edge_count": total_edges,
        "node_types": node_types,
        "edge_types": edge_types,
        "community_count": community_count,
    }


@router.get(
    "/peel-chains",
    summary="Detect and trace sequential peel chain pass-through patterns",
)
def get_graph_peel_chains(
    min_length: int = Query(3, ge=1, description="Minimum peel chain length"),
) -> List[Dict[str, Any]]:
    """Identify sequential peel chains and return serialized path subgraphs."""
    cypher, params = get_peel_chains(min_length=min_length)

    try:
        with get_neo4j_session() as session:
            result = session.run(cypher, params)
            records = list(result)
            return [neo4j_result_to_graph_json([rec]) for rec in records]
    except Exception as e:
        logger.warning("Error scanning peel chains: %s", e)
        return []


@router.get(
    "/fan-out",
    summary="Identify fan-out splitting transactions",
)
def get_graph_fan_out(
    min_outputs: int = Query(10, ge=1, description="Minimum output wallet count"),
) -> List[Dict[str, Any]]:
    """Identify high fan-out transactions distributing funds across multiple outputs."""
    cypher, params = get_fan_out_transactions(min_outputs=min_outputs)

    try:
        with get_neo4j_session() as session:
            result = session.run(cypher, params)
            return [
                {"txid": str(rec["txid"]), "out_count": int(rec["out_count"])}
                for rec in result
            ]
    except Exception as e:
        logger.warning("Error fetching fan-out transactions: %s", e)
        return []
