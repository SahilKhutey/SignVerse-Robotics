import pytest
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app, API_KEY

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "SignVerse Gateway"}

def test_command_requires_auth():
    # Should fail with 403 Forbidden because no X-API-Key is provided
    response = client.post("/api/command", json={"command": "move to 90 degrees"})
    assert response.status_code == 403

def test_command_with_invalid_auth():
    response = client.post("/api/command", headers={"X-API-Key": "wrong_key"}, json={"command": "move to 90 degrees"})
    assert response.status_code == 403

def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert b"signverse_commands_total" in response.content
    assert b"signverse_telemetry_mode" in response.content
