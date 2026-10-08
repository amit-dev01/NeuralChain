import pytest
from app.ingest.blockchain_client import fetch_address_transactions


def test_blockchain_client_returns_records():
    """Verify blockchain client returns valid TransactionRecord list even if offline."""
    records = fetch_address_transactions("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", limit=5)
    assert len(records) > 0
    assert records[0].txid is not None
    assert len(records[0].input_addresses) > 0 or len(records[0].output_addresses) > 0


def test_investigate_address_endpoint(client):
    """Verify POST /api/v1/ingest/address processes address and returns forensic profile."""
    payload = {
        "address": "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX",
        "limit": 5,
        "auto_run_ml": True,
    }
    response = client.post("/api/v1/ingest/address", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["address"] == "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX"
    assert data["tx_count"] > 0
    assert "risk_score" in data
    assert "risk_level" in data
    assert "ai_summary" in data
    assert len(data["ai_summary"]) > 20
