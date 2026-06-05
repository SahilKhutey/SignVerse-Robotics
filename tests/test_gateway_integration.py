import pytest
import time
import os
import asyncio
import h5py
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect
from starlette.testclient import WebSocketDenialResponse
from unittest.mock import patch, MagicMock
from pathlib import Path

from core.deployment.api_gateway.gateway import app, API_KEY
from core.deployment.api_gateway import gateway_state
from core.deployment.api_gateway.online_learner import OnlineLearner
from core.deployment.api_gateway.replay_buffer import ReplayBuffer
from core.deployment.api_gateway.ewc import EWC

@pytest.fixture(scope="module")
def client():
    # Setup temporary DB path for testing
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = ".tmp_test_artifacts/test_gateway.db"
    
    with TestClient(app) as c:
        yield c
        
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

@pytest.mark.asyncio
async def test_session_stop_triggers_async_update(client):
    # Ensure active learner exists in app state / gateway_state
    kernel = gateway_state.kernel
    if kernel is None:
        # Mock kernel and orchestrator
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
        
    # Setup recorder mock
    kernel.orchestrator.recorder._episode_id = "test_episode"
    kernel.orchestrator.recorder.db_path = Path(".tmp_test_artifacts/test_gateway.db")
    
    # Mock online_learner
    mock_ol = MagicMock()
    # Mock the update method to return a valid LearningEvent dict
    async def mock_update(frames):
        # Trigger broadcast manually to ws clients
        from core.deployment.api_gateway.gateway import broadcast_learning_event
        await broadcast_learning_event({
            "type": "update_complete",
            "step": 42,
            "loss": 0.02,
            "val_accuracy": 0.85,
            "per_task_accuracy": {"task_a": 0.85},
            "learning_rate": 1e-4,
            "replay_ratio": 0.2,
            "timestamp_ms": int(time.time() * 1000)
        })
    mock_ol.update = mock_update
    kernel.online_learner = mock_ol
    
    # Start WS listener in a task or use synchronous client.websocket_connect
    t0 = time.perf_counter()
    
    # Trigger stop recording
    response = client.post(
        "/api/record/stop",
        headers={"X-API-Key": API_KEY},
        json={"session_label": "test_sess", "motion_type": "wave_hand"}
    )
    duration = time.perf_counter() - t0
    
    # Assert response returns in < 200ms
    assert duration < 0.20
    assert response.status_code == 200
    
    # Now verify learning event arrives on WS within 2s
    with client.websocket_connect("/ws/learning_events") as ws:
        # We need to trigger the stop recording again while WS is connected,
        # or verify the event is sent.
        # Let's trigger the stop again (since recorder will reset episode, we set J0, reset mock episode id)
        kernel.orchestrator.recorder._episode_id = "test_episode"
        client.post(
            "/api/record/stop",
            headers={"X-API-Key": API_KEY},
            json={"session_label": "test_sess", "motion_type": "wave_hand"}
        )
        
        # Wait up to 2 seconds for event
        event = ws.receive_json()
        assert event["type"] == "update_complete"
        assert event["step"] == 42

def test_ws_learning_events_schema(client):
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
        
    kernel.orchestrator.recorder._episode_id = "test_episode"
    
    with client.websocket_connect("/ws/learning_events") as ws:
        client.post(
            "/api/record/stop",
            headers={"X-API-Key": API_KEY},
            json={"session_label": "test_sess", "motion_type": "wave_hand"}
        )
        event = ws.receive_json()
        
        # Validate event schema matches LearningEvent TypedDict
        expected_keys = {
            "type", "step", "loss", "val_accuracy", "per_task_accuracy",
            "learning_rate", "replay_ratio", "timestamp_ms"
        }
        assert set(event.keys()) == expected_keys
        assert event["type"] == "update_complete"

def test_multiple_ws_subscribers_all_receive_events(client):
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
        
    kernel.orchestrator.recorder._episode_id = "test_episode"
    
    # Connect 3 subscribers
    with client.websocket_connect("/ws/learning_events") as ws1, \
         client.websocket_connect("/ws/learning_events") as ws2, \
         client.websocket_connect("/ws/learning_events") as ws3:
         
        # Trigger event
        client.post(
            "/api/record/stop",
            headers={"X-API-Key": API_KEY},
            json={"session_label": "test_sess", "motion_type": "wave_hand"}
        )
        
        t0 = time.time()
        e1 = ws1.receive_json()
        t1 = time.time()
        e2 = ws2.receive_json()
        t2 = time.time()
        e3 = ws3.receive_json()
        t3 = time.time()
        
        # Assert all 3 receive within 100ms of each other
        assert abs(t2 - t1) < 0.10
        assert abs(t3 - t2) < 0.10
        assert e1["step"] == 42
        assert e2["step"] == 42
        assert e3["step"] == 42

def test_hdf5_export_file_structure(client, tmp_path):
    # Setup mock episode database frames response
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
        
    # Start and stop recording to generate SQLite entries (or mock get_session_frames)
    episode_id = "test_export_episode"
    
    # Get HDF5 export FileResponse
    response = client.get(f"/api/sessions/{episode_id}/export?format=hdf5", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    
    # Save the response contents to a file to open with h5py
    file_path = tmp_path / "export.h5"
    with open(file_path, "wb") as f:
        f.write(response.content)
        
    # Open with h5py and assert datasets
    with h5py.File(file_path, "r") as f:
        assert "data/joint_angles" in f
        assert "metadata" in f
        
        dataset = f["data/joint_angles"]
        # shape should be (N, 7)
        assert len(dataset.shape) == 2
        assert dataset.shape[1] == 7
        
        metadata = f["metadata"]
        assert "label" in metadata.attrs

def test_webrtc_token_expiry_enforced(client):
    # Create share token
    response = client.post("/api/share/start", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    token = response.json()["token"]
    
    # Fast-forward time past 1 hour (3600 seconds) by patching time.time
    # or updating the created_at timestamp in active_shares directly
    active_share = gateway_state.active_shares.get(token)
    assert active_share is not None
    active_share["created_at"] = time.time() - 3601
    
    # Verify via API returns 404/403 or invalid
    verify_resp = client.get(f"/api/share/verify?token={token}")
    assert verify_resp.status_code == 404
    
    # Verify WS connection is closed/rejected at handshake
    with pytest.raises(WebSocketDenialResponse) as exc_info:
        with client.websocket_connect(f"/ws/observe?token={token}&role=observer"):
            pass
    assert exc_info.value.status_code == 404
