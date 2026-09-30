from datetime import datetime


def test_health_endpoint_returns_200(client):
    """Test health endpoint responds with HTTP 200 and valid status indicator."""
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert body["status"] in ["ok", "degraded"]


def test_health_has_all_service_keys(client):
    """Verify health endpoint checks postgres, redis, neo4j, and celery dependencies."""
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "services" in body
    services = body["services"]
    assert "postgres" in services
    assert "redis" in services
    assert "neo4j" in services
    assert "celery" in services
    assert all(v in ["ok", "error"] for v in services.values())


def test_health_has_timestamp(client):
    """Verify health endpoint includes version string and parseable ISO 8601 timestamp."""
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert "timestamp" in body
    assert "version" in body
    parsed_dt = datetime.fromisoformat(body["timestamp"].replace("Z", "+00:00"))
    assert isinstance(parsed_dt, datetime)
