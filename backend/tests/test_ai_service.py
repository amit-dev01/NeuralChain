from unittest.mock import MagicMock, patch
import pytest
from app.core.config import settings
from app.core.gemini_client import (
    generate_content_with_fallback,
    is_gemini_configured,
)


def test_ai_status_endpoint(client):
    """Verify /api/v1/ai/status returns 200 with model and configuration info."""
    response = client.get("/api/v1/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert "configured" in data
    assert "primary_model" in data
    assert "fallback_model" in data
    assert "gemma" in data["primary_model"].lower()
    assert "flash" in data["fallback_model"].lower()
    assert "mode" in data


def test_ai_generate_summary_endpoint(client):
    """Verify /api/v1/ai/generate-summary produces an executive brief."""
    payload = {
        "total_transactions": 2500,
        "active_alerts": 42,
        "high_risk_entities": 7,
        "risk_threshold": 0.75,
        "top_typologies": ["peeling_chain", "tumbler_pool"],
        "time_window": "Q3 2026",
    }
    response = client.post("/api/v1/ai/generate-summary", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["summary"]) > 50
    assert "model_used" in data


def test_ai_explain_shap_endpoint(client):
    """Verify /api/v1/ai/explain-shap explains anomaly metrics in plain English."""
    payload = {
        "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "risk_score": 0.88,
        "anomaly_type": "Peel Chain Pass-Through",
        "shap_features": {
            "velocity_ratio": 0.55,
            "fee_rate_deviation": 0.32,
        },
        "typologies": ["peeling_chain"],
    }
    response = client.post("/api/v1/ai/explain-shap", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" in data["summary"] or len(data["summary"]) > 30


def test_ai_copilot_endpoint(client):
    """Verify /api/v1/ai/copilot responds to investigative inquiries."""
    payload = {
        "prompt": "How does peel chain peeling differ from normal change output spending?",
        "context": {"suspect_address": "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"},
    }
    response = client.post("/api/v1/ai/copilot", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["response"]) > 20


def test_offline_mode_resilience():
    """Verify that when no API key is set, client provides deterministic forensic responses."""
    with patch.object(settings, "GEMINI_API_KEY", ""):
        assert is_gemini_configured() is False
        res = generate_content_with_fallback("Analyze this wallet")
        assert res["success"] is True
        assert res["is_offline_simulated"] is True
        assert res["model_used"] == "offline-forensic-engine"


def test_fallback_mechanism_when_primary_fails():
    """Verify that when the primary Gemma model raises an exception, it falls back to Gemini Flash."""
    mock_client = MagicMock()

    # Configure primary model to fail, fallback model to succeed
    def mock_generate_content(model, contents, config):
        if "gemma" in model.lower():
            raise RuntimeError("Model 'gemma-4-31b-it' endpoint unavailable")
        response = MagicMock()
        response.text = "Fallback Gemini Flash output analysis"
        return response

    mock_client.models.generate_content.side_effect = mock_generate_content

    with patch("app.core.gemini_client.get_gemini_client", return_value=mock_client), \
         patch.object(settings, "GEMINI_API_KEY", "test_key_123"):
        res = generate_content_with_fallback("Analyze transaction")
        assert res["success"] is True
        assert res["fallback_applied"] is True
        assert "flash" in res["model_used"].lower()
        assert res["text"] == "Fallback Gemini Flash output analysis"
