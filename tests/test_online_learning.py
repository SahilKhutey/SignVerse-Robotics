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

def test_online_state_endpoint():
    response = client.get("/api/online/state")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "total_steps" in data
    assert "current_lr" in data
    assert "replay_buffer_size" in data
    assert "checkpoint_count" in data
    assert "ewc_lambda" in data

def test_online_pause_endpoint():
    response = client.post("/api/online/pause", json={"paused": True})
    assert response.status_code in {200, 503}
    if response.status_code == 200:
        data = response.json()
        assert data["status"] == "paused"

def test_online_config_endpoint():
    # Valid config
    response = client.post("/api/online/config", json={"learning_rate": 1e-4, "ewc_lambda": 100.0, "replay_ratio": 0.2})
    assert response.status_code in {200, 503}
    
    # Invalid config - learning rate out of range (under)
    response_lr_under = client.post("/api/online/config", json={"learning_rate": 1e-6})
    assert response_lr_under.status_code in {400, 422, 503}
    
    # Invalid config - learning rate out of range (over)
    response_lr_over = client.post("/api/online/config", json={"learning_rate": 1e-3})
    assert response_lr_over.status_code in {400, 422, 503}
    
    # Invalid config - ewc_lambda out of range
    response_lambda_over = client.post("/api/online/config", json={"ewc_lambda": 6000.0})
    assert response_lambda_over.status_code in {400, 422, 503}
    
    # Invalid config - replay_ratio out of range
    response_ratio_over = client.post("/api/online/config", json={"replay_ratio": 0.6})
    assert response_ratio_over.status_code in {400, 422, 503}

def test_online_replay_buffer_paginated():
    response = client.get("/api/online/replay_buffer?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "entries" in data
    assert "capacity" in data
    assert "fill_percent" in data
    assert "total_count" in data

def test_bad_lr_does_not_crash():
    response = client.post("/api/online/config", json={"learning_rate": 1.0})
    assert response.status_code == 422
    data = response.json()
    assert "learning_rate must be ≤ 5e-4" in data["detail"][0]["msg"]

