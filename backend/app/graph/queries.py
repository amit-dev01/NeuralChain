from typing import Any, Dict, Tuple


def get_ego_graph(wallet_id: str, depth: int = 2) -> Tuple[str, Dict[str, Any]]:
    """
    Build ego graph query exploring all nodes connected to a wallet up to depth steps.
    Returns: (cypher_query, params)
    """
    validated_depth = max(1, min(int(depth), 4))
    query = (
        f"MATCH path = (w:Wallet {{address: $wallet_id}})-[*1..{validated_depth}]-(n) "
        "RETURN path"
    )
    return query, {"wallet_id": wallet_id, "depth": validated_depth}


def get_common_input_clusters() -> Tuple[str, Dict[str, Any]]:
    """
    Identify clusters of wallet addresses that frequently appear together as transaction inputs.
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH (w1:Wallet)-[:SENT]->(t:Transaction)<-[:SENT]-(w2:Wallet) "
        "WHERE w1.address <> w2.address "
        "RETURN w1.address AS wallet1, w2.address AS wallet2, "
        "count(t) AS shared_inputs "
        "ORDER BY shared_inputs DESC LIMIT 1000"
    )
    return query, {}


def get_peel_chains(min_length: int = 3) -> Tuple[str, Dict[str, Any]]:
    """
    Detect peel chain structures (sequential linear pass-through transactions).
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH path = (start:Wallet)-[:SENT]->(t1:Transaction)-[:RECEIVED]->(mid:Wallet) "
        "WHERE size((mid)-[:SENT]->()) = 1 "
        "AND size((mid)<-[:RECEIVED]-()) = 1 "
        "WITH path, length(path) AS chain_len "
        "WHERE chain_len >= $min_length "
        "RETURN path ORDER BY chain_len DESC LIMIT 50"
    )
    return query, {"min_length": int(min_length)}


def get_change_address_candidates() -> Tuple[str, Dict[str, Any]]:
    """
    Identify one-time use wallets receiving change outputs.
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH (t:Transaction)-[:RECEIVED]->(w:Wallet) "
        "WHERE size((w)<-[:RECEIVED]-()) = 1 "
        "AND size((w)-[:SENT]->()) = 1 "
        "AND w.tx_count = 1 "
        "RETURN w.address AS change_address, t.txid AS source_tx"
    )
    return query, {}


def get_fan_out_transactions(min_outputs: int = 10) -> Tuple[str, Dict[str, Any]]:
    """
    Identify high fan-out transactions distributing funds across multiple distinct outputs.
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH (t:Transaction)-[:RECEIVED]->(w:Wallet) "
        "WITH t, count(w) AS out_count "
        "WHERE out_count >= $min_outputs "
        "RETURN t.txid AS txid, out_count ORDER BY out_count DESC"
    )
    return query, {"min_outputs": int(min_outputs)}


def get_shortest_path(wallet_a: str, wallet_b: str) -> Tuple[str, Dict[str, Any]]:
    """
    Find shortest connecting path between two arbitrary wallet addresses.
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH path = shortestPath("
        "(a:Wallet {address: $wallet_a})-[*]-(b:Wallet {address: $wallet_b})"
        ") "
        "RETURN path"
    )
    return query, {"wallet_a": wallet_a, "wallet_b": wallet_b}


def get_graph_stats() -> Tuple[str, Dict[str, Any]]:
    """
    Query summary distribution of graph entity node labels.
    Returns: (cypher_query, params)
    """
    query = "MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count"
    return query, {}


def get_wallet_details(wallet_id: str) -> Tuple[str, Dict[str, Any]]:
    """
    Query full 360-degree connectivity details for a single wallet address.
    Returns: (cypher_query, params)
    """
    query = (
        "MATCH (w:Wallet {address: $wallet_id}) "
        "OPTIONAL MATCH (w)-[:SENT]->(t:Transaction) "
        "OPTIONAL MATCH (w)<-[:RECEIVED]-(t2:Transaction) "
        "OPTIONAL MATCH (w)<-[:CONNECTED_FROM]-(ip:IP) "
        "RETURN w, collect(DISTINCT t) as sent_txs, "
        "collect(DISTINCT t2) as received_txs, "
        "collect(DISTINCT ip) as ips"
    )
    return query, {"wallet_id": wallet_id}
