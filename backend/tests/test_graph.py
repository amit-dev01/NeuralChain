from unittest.mock import MagicMock

from app.graph.queries import get_common_input_clusters, get_peel_chains
from app.graph.serializer import neo4j_result_to_graph_json


class MockNode:
    """Mock node for testing graph serialization."""

    def __init__(self, node_id: str, labels: list[str], props: dict | None = None):
        self.id = node_id
        self.labels = set(labels)
        self._props = props or (
            {"address": node_id} if "Wallet" in labels else {"txid": node_id}
        )

    def items(self):
        return self._props.items()

    def get(self, k, default=None):
        return self._props.get(k, default)

    def __getitem__(self, k):
        return self._props[k]


class MockRelationship:
    """Mock relationship for testing graph serialization."""

    def __init__(
        self,
        start_node: MockNode,
        end_node: MockNode,
        rel_type: str = "SENT",
        props: dict | None = None,
    ):
        self.start_node = start_node
        self.end_node = end_node
        self.type = rel_type
        self._props = props or {"amount": 1.5}

    def items(self):
        return self._props.items()

    def get(self, k, default=None):
        return self._props.get(k, default)


class MockRecord:
    """Mock Neo4j record containing graph entities."""

    def __init__(self, data_dict: dict):
        self._data = data_dict

    def values(self):
        return list(self._data.values())

    def __getitem__(self, k):
        return self._data[k]


def test_graph_nodes_endpoint_returns_correct_shape(client, mock_neo4j):
    """Test /api/v1/graph/nodes returns standard nodes, links, and meta structure."""
    node1 = MockNode("wallet_abc", ["Wallet"], {"address": "wallet_abc", "risk_score": 0.5})
    node2 = MockNode("tx_xyz", ["Transaction"], {"txid": "tx_xyz", "amount": 2.0})
    rel = MockRelationship(node1, node2, "SENT")
    mock_record = MockRecord({"r": rel})

    mock_neo4j.run.return_value = [mock_record]

    response = client.get("/api/v1/graph/nodes?start=wallet_abc&depth=1")
    assert response.status_code == 200
    body = response.json()
    assert "nodes" in body
    assert "links" in body
    assert isinstance(body["nodes"], list)
    assert "meta" in body


def test_graph_stats_endpoint(client, mock_neo4j, sample_dataset):
    """Test /api/v1/graph/stats returns aggregate node and edge counts."""
    # mock_neo4j.run returns query results for node counts and edge counts
    mock_neo4j.run.side_effect = [
        [{"type": "Wallet", "count": 100}],  # nodes
        [{"type": "SENT", "count": 250}],   # edges
    ]

    response = client.get("/api/v1/graph/stats")
    assert response.status_code == 200
    body = response.json()
    assert "node_count" in body
    assert "edge_count" in body
    assert "node_types" in body


def test_peel_chain_cypher_query():
    """Verify peel chain cypher query constructs valid MATCH/RETURN expressions."""
    cypher, params = get_peel_chains(min_length=3)
    assert "MATCH" in cypher
    assert "min_length" in params or "3" in cypher or "$min_length" in cypher
    assert "RETURN" in cypher


def test_common_input_clustering_query():
    """Verify common input clustering cypher query searches shared inputs."""
    cypher, params = get_common_input_clusters()
    assert "SENT" in cypher
    assert "Transaction" in cypher
    assert "shared_inputs" in cypher.lower() or "count" in cypher.lower()


def test_neo4j_result_to_graph_json():
    """Verify serialization of Neo4j records into nodes and links format."""
    node1 = MockNode("wallet_1", ["Wallet"], {"address": "wallet_1"})
    node2 = MockNode("tx_1", ["Transaction"], {"txid": "tx_1"})
    rel = MockRelationship(node1, node2, "SENT")
    mock_records = [MockRecord({"r": rel})]

    result = neo4j_result_to_graph_json(mock_records)
    assert "nodes" in result
    assert "links" in result
    assert len(result["nodes"]) == 2
    assert len(result["links"]) == 1
    assert "id" in result["nodes"][0]
    assert "type" in result["nodes"][0]
