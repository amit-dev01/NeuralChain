import logging
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Try to import Neo4j graph types for robust isinstance checks
try:
    from neo4j.graph import Node as Neo4jNode
    from neo4j.graph import Path as Neo4jPath
    from neo4j.graph import Relationship as Neo4jRelationship
except ImportError:
    Neo4jNode = None
    Neo4jPath = None
    Neo4jRelationship = None


def _to_json_compatible(val: Any) -> Any:
    """Convert Neo4j specific objects (DateTime, Point, etc.) to JSON serializable types."""
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if isinstance(val, (list, tuple, set)):
        return [_to_json_compatible(x) for x in val]
    if isinstance(val, dict):
        return {str(k): _to_json_compatible(v) for k, v in val.items()}
    return str(val)


def wallet_node_to_dict(node: Any) -> Dict[str, Any]:
    """Extract all properties from a Neo4j Node object into a plain python dictionary."""
    if node is None:
        return {}

    props: Dict[str, Any] = {}
    if isinstance(node, dict):
        props = dict(node)
    else:
        try:
            props = dict(node)
        except Exception:
            if hasattr(node, "items"):
                props = {k: v for k, v in node.items()}
            elif hasattr(node, "__dict__"):
                props = {k: v for k, v in node.__dict__.items() if not k.startswith("_")}

    return {k: _to_json_compatible(v) for k, v in props.items()}


def _extract_node_info(node: Any) -> Tuple[str, str, str, float, Optional[int], Dict[str, Any]]:
    """
    Extract (id, type, label, risk_score, cluster_id, properties) from a Neo4j Node or dict.
    """
    props = wallet_node_to_dict(node)

    # Determine node type from labels or properties
    node_type = "Wallet"
    labels: Set[str] = set()
    if hasattr(node, "labels"):
        try:
            labels = set(node.labels)
        except Exception:
            pass
    elif "_labels" in props and isinstance(props["_labels"], (list, set, tuple)):
        labels = set(props["_labels"])

    for candidate in ("Transaction", "Wallet", "IP", "ASN", "Country"):
        if candidate in labels:
            node_type = candidate
            break
    else:
        if labels:
            node_type = str(next(iter(labels)))
        elif "type" in props:
            node_type = str(props["type"])

    # Determine node ID based on primary entity type
    node_id = ""
    if node_type == "Wallet":
        node_id = str(props.get("address") or props.get("id") or "")
    elif node_type == "Transaction":
        node_id = str(props.get("txid") or props.get("id") or "")
    elif node_type == "IP":
        node_id = str(props.get("address") or props.get("ip") or props.get("id") or "")
    elif node_type == "Country":
        node_id = str(props.get("code") or props.get("country") or props.get("id") or "")
    elif node_type == "ASN":
        node_id = str(props.get("id") or props.get("asn") or "")

    if not node_id:
        node_id = str(
            props.get("id")
            or props.get("address")
            or props.get("txid")
            or getattr(node, "element_id", "")
            or getattr(node, "id", "")
        )

    # Short display label
    custom_label = props.get("label")
    if custom_label:
        display_label = str(custom_label)
    elif node_type == "Wallet":
        addr = props.get("address") or node_id
        display_label = f"{addr[:6]}...{addr[-4:]}" if len(addr) > 12 else addr
    elif node_type == "Transaction":
        txid = props.get("txid") or node_id
        display_label = f"{txid[:8]}..." if len(txid) > 8 else txid
    elif node_type == "IP":
        display_label = props.get("address") or node_id
    elif node_type == "ASN":
        display_label = str(props.get("id") or props.get("asn") or node_id)
    elif node_type == "Country":
        display_label = str(props.get("code") or props.get("country") or node_id)
    else:
        display_label = node_id[:12] if len(node_id) > 12 else node_id

    # Risk score
    try:
        risk_score = float(props.get("risk_score", 0.0) or 0.0)
    except (ValueError, TypeError):
        risk_score = 0.0

    # Cluster ID
    raw_cluster = props.get("cluster_id")
    cluster_id = None
    if raw_cluster is not None:
        try:
            cluster_id = int(raw_cluster)
        except (ValueError, TypeError):
            cluster_id = None

    return node_id, node_type, display_label, risk_score, cluster_id, props


def _extract_rel_info(rel: Any) -> Tuple[str, str, str, float, Dict[str, Any]]:
    """
    Extract (source_id, target_id, type, value, properties) from a Neo4j Relationship or dict.
    """
    props = wallet_node_to_dict(rel)
    rel_type = "CONNECTED"
    if hasattr(rel, "type"):
        rel_type = str(rel.type)
    elif "type" in props:
        rel_type = str(props["type"])

    source_id = ""
    target_id = ""

    if hasattr(rel, "start_node") and hasattr(rel, "end_node"):
        s_id, _, _, _, _, _ = _extract_node_info(rel.start_node)
        t_id, _, _, _, _, _ = _extract_node_info(rel.end_node)
        source_id = s_id
        target_id = t_id
    elif hasattr(rel, "nodes") and len(rel.nodes) == 2:
        s_id, _, _, _, _, _ = _extract_node_info(rel.nodes[0])
        t_id, _, _, _, _, _ = _extract_node_info(rel.nodes[1])
        source_id = s_id
        target_id = t_id
    else:
        source_id = str(props.get("source") or props.get("start") or "")
        target_id = str(props.get("target") or props.get("end") or "")

    raw_val = props.get("amount") or props.get("value") or 1.0
    try:
        value = float(raw_val)
    except (ValueError, TypeError):
        value = 1.0

    return source_id, target_id, rel_type, value, props


def neo4j_result_to_graph_json(
    records: list, include_properties: bool = True
) -> Dict[str, Any]:
    """
    Convert a list of Neo4j Record objects (from driver session.run()) into a
    standard graph JSON dictionary: { "nodes": [...], "links": [...] }
    with deduplication by node ID and link (source, target, type).
    """
    nodes_map: Dict[str, Dict[str, Any]] = {}
    links_map: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    def _process_node(node_obj: Any) -> None:
        if node_obj is None:
            return
        n_id, n_type, n_label, n_risk, n_cluster, n_props = _extract_node_info(node_obj)
        if not n_id:
            return
        if n_id not in nodes_map:
            nodes_map[n_id] = {
                "id": n_id,
                "type": n_type,
                "label": n_label,
                "risk_score": n_risk,
                "cluster_id": n_cluster,
                "properties": n_props if include_properties else {},
            }
        else:
            # Merge properties or higher risk score if already discovered
            existing = nodes_map[n_id]
            if n_risk > existing["risk_score"]:
                existing["risk_score"] = n_risk
            if n_cluster is not None and existing["cluster_id"] is None:
                existing["cluster_id"] = n_cluster
            if include_properties:
                existing["properties"].update(n_props)

    def _process_relationship(rel_obj: Any) -> None:
        if rel_obj is None:
            return
        # Ensure start and end nodes are registered
        if hasattr(rel_obj, "start_node"):
            _process_node(rel_obj.start_node)
        if hasattr(rel_obj, "end_node"):
            _process_node(rel_obj.end_node)
        elif hasattr(rel_obj, "nodes") and len(rel_obj.nodes) == 2:
            _process_node(rel_obj.nodes[0])
            _process_node(rel_obj.nodes[1])

        src, tgt, r_type, val, r_props = _extract_rel_info(rel_obj)
        if not src or not tgt:
            return

        link_key = (src, tgt, r_type)
        if link_key not in links_map:
            links_map[link_key] = {
                "source": src,
                "target": tgt,
                "type": r_type,
                "value": val,
                "properties": r_props if include_properties else {},
            }

    def _process_element(elem: Any) -> None:
        if elem is None:
            return

        # Check Path
        if (Neo4jPath and isinstance(elem, Neo4jPath)) or (
            hasattr(elem, "nodes") and hasattr(elem, "relationships")
        ):
            for n in elem.nodes:
                _process_node(n)
            for r in elem.relationships:
                _process_relationship(r)
            return

        # Check Node
        if (Neo4jNode and isinstance(elem, Neo4jNode)) or hasattr(elem, "labels"):
            _process_node(elem)
            return

        # Check Relationship
        if (Neo4jRelationship and isinstance(elem, Neo4jRelationship)) or hasattr(
            elem, "type"
        ):
            _process_relationship(elem)
            return

        # Check collections
        if isinstance(elem, (list, tuple, set)):
            for sub_elem in elem:
                _process_element(sub_elem)
            return

        # Check dictionary
        if isinstance(elem, dict):
            if "nodes" in elem and "links" in elem:
                for n in elem["nodes"]:
                    _process_node(n)
                for l in elem["links"]:
                    _process_relationship(l)
            elif "address" in elem or "txid" in elem:
                _process_node(elem)
            elif "source" in elem and "target" in elem:
                _process_relationship(elem)

    # Process all incoming records
    for rec in records:
        if rec is None:
            continue
        if isinstance(rec, dict) and ("source" in rec and "target" in rec):
            _process_relationship(rec)
        elif isinstance(rec, dict) and ("address" in rec or "txid" in rec or "code" in rec):
            _process_node(rec)
        elif isinstance(rec, dict) and ("nodes" in rec and "links" in rec):
            _process_element(rec)
        elif hasattr(rec, "values"):
            for val in rec.values():
                _process_element(val)
        elif hasattr(rec, "data"):
            data_dict = rec.data()
            for val in data_dict.values():
                _process_element(val)
        elif isinstance(rec, (list, tuple)):
            for val in rec:
                _process_element(val)
        else:
            _process_element(rec)

    return {
        "nodes": list(nodes_map.values()),
        "links": list(links_map.values()),
    }
