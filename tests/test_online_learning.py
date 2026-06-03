import pytest
import os
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app, API_KEY

client = None

@pytest.fixture(scope="module", autouse=True)
def setup_client():
    global client
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    tmp_dir = Path(".tmp_test_artifacts") / f"learning_{uuid.uuid4().hex}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = str(tmp_dir / "teleoperation.db")
    
    with TestClient(app) as c:
        client = c
        yield c
        
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

def test_learning_status_endpoint():
    response = client.get("/api/learning/status", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "step" in data
    assert "learning_rate" in data
    assert "replay_buffer_size" in data
    assert "checkpoints_count" in data
    assert "forgetting_alerts" in data

def test_replay_buffer_endpoint():
    response = client.get("/api/learning/replay_buffer", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "demos" in data
    assert isinstance(data["demos"], list)
    if len(data["demos"]) > 0:
        demo = data["demos"][0]
        assert "id" in demo
        assert "label" in demo
        assert "divergenceScore" in demo
        assert "highlighted" in demo

def test_forgetting_monitor_endpoint():
    response = client.get("/api/learning/forgetting_monitor", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "task_accuracies" in data
    assert "alerts" in data
    assert isinstance(data["alerts"], list)

def test_learning_rate_update():
    # Valid LR update
    response = client.post("/api/learning/lr", headers={"X-API-Key": API_KEY}, json={"lr": 2e-4})
    # If the kernel/online learner is not initialized in the test environment, 
    # it might return 503 Service Unavailable ("Online learner offline").
    # We assert it is 200 (if initialized) or 503 (if offline), but not 403 or 500.
    assert response.status_code in {200, 503}
    if response.status_code == 200:
        data = response.json()
        assert data["status"] == "success"
        assert data["lr"] == 2e-4

    # Invalid LR update (under limits)
    response_low = client.post("/api/learning/lr", headers={"X-API-Key": API_KEY}, json={"lr": 1e-6})
    assert response_low.status_code in {400, 503}
    if response_low.status_code == 400:
        assert "Learning rate must be between" in response_low.json()["detail"]

    # Invalid LR update (over limits)
    response_high = client.post("/api/learning/lr", headers={"X-API-Key": API_KEY}, json={"lr": 1e-2})
    assert response_high.status_code in {400, 503}
    if response_high.status_code == 400:
        assert "Learning rate must be between" in response_high.json()["detail"]
