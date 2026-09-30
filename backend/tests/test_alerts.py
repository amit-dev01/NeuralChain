from app.alerts.explainer import generate_text_explanation
from app.alerts.scorer import compute_risk_score


def test_get_alerts_paginated(client, sample_alerts):
    """Test GET /api/v1/alerts returns paginated results matching total count."""
    response = client.get("/api/v1/alerts?page=1&limit=10")
    assert response.status_code == 200
    body = response.json()
    assert "alerts" in body
    assert "total" in body
    assert "page" in body
    assert body["page"] == 1
    assert len(body["alerts"]) <= 10
    assert body["total"] == 5


def test_get_alerts_filtered_by_status(client, sample_alerts):
    """Test filtering alerts by status."""
    response = client.get("/api/v1/alerts?status=new")
    assert response.status_code == 200
    body = response.json()
    assert len(body["alerts"]) > 0
    assert all(a["status"] == "new" for a in body["alerts"])


def test_get_alerts_filtered_by_risk_min(client, sample_alerts):
    """Test filtering alerts by minimum risk score."""
    response = client.get("/api/v1/alerts?risk_min=0.8")
    assert response.status_code == 200
    body = response.json()
    assert len(body["alerts"]) > 0
    assert all(a["risk_score"] >= 0.8 for a in body["alerts"])


def test_alert_status_patch(client, sample_alerts):
    """Test PATCH /api/v1/alerts/{id}/status transitions status."""
    alert_id = str(sample_alerts[0].id)
    response = client.patch(
        f"/api/v1/alerts/{alert_id}/status",
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "confirmed"


def test_alert_not_found_returns_404(client):
    """Test non-existent alert returns 404."""
    response = client.get("/api/v1/alerts/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_risk_scorer_weight_normalization():
    """Verify compute_risk_score re-normalizes available subset weights."""
    score = compute_risk_score(if_score=0.8, xgb_score=0.6)
    expected = (0.20 / (0.20 + 0.35)) * 0.8 + (0.35 / (0.20 + 0.35)) * 0.6
    assert abs(score - expected) < 1e-5
    assert 0.0 <= score <= 1.0


def test_text_explanation_generated():
    """Verify narrative text explanation generation incorporates model and reasons."""
    shap = {"fee_ratio": 0.4, "fan_out": 0.3, "round_amount_flag": 0.1}
    vals = {"fee_ratio": 3.2, "fan_out": 83, "round_amount_flag": 1}
    text = generate_text_explanation(shap, vals, "XGBoost", 0.961)
    assert isinstance(text, str)
    assert len(text) > 20
    assert "XGBoost" in text or "flagged" in text.lower()


def test_alert_stats_summary(client, sample_alerts):
    """Test GET /api/v1/alerts/stats/summary computes total and distribution."""
    response = client.get("/api/v1/alerts/stats/summary")
    assert response.status_code == 200
    body = response.json()
    assert "critical" in body
    assert "total" in body
    assert body["total"] == 5
