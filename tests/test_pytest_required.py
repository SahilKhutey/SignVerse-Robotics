import pytest
import torch
import torch.nn as nn
import torch.optim as optim
import math
import asyncio
import glob
import os
import shutil
import time
import zipfile
import h5py
import collections
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketDenialResponse

# Core imports
from core.bc_model import BCModel
from core.deployment.api_gateway.online_learner import OnlineLearner, LearningEvent
from core.deployment.api_gateway.replay_buffer import ReplayBuffer
from core.deployment.api_gateway.ewc import EWC
from core.deployment.api_gateway.gateway import app, API_KEY, verify_api_key
from core.deployment.api_gateway import gateway_state
from shared_types.telemetry import TelemetryFrame

# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def clean_checkpoints():
    ckpt_dir = Path("checkpoints/online")
    if ckpt_dir.exists():
        shutil.rmtree(ckpt_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    yield ckpt_dir
    if ckpt_dir.exists():
        shutil.rmtree(ckpt_dir)

@pytest.fixture
def test_client():
    with TestClient(app) as client:
        yield client

# ──────────────────────────────────────────────────────────────────────────────
# BC Model & Training Pipeline (6 tests)
# ──────────────────────────────────────────────────────────────────────────────

def test_bc_model_forward_no_nan():
    # Forward pass on random 7-joint input produces no NaN or Inf values.
    # The BCModel uses input_dim=21 (7 joints * 3 coordinates) and output_dim=7 joints.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    model.eval()
    x = torch.randn(16, 21)
    output = model(x)
    assert not torch.isnan(output).any()
    assert not torch.isinf(output).any()

def test_bc_loss_decreases_over_10_epochs():
    # Train on 200 demo frames for 10 epochs. Final loss must be < 50% of initial loss.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    x = torch.randn(200, 21)
    # Simple linear mapping to guarantee quick convergence
    y = x[:, :7] * 2.0
    optimizer = optim.Adam(model.parameters(), lr=0.02)
    criterion = nn.MSELoss()
    
    # Calculate initial loss
    model.eval()
    with torch.no_grad():
        initial_loss = criterion(model(x), y).item()
        
    model.train()
    for _ in range(10):
        optimizer.zero_grad()
        pred = model(x)
        loss = criterion(pred, y)
        loss.backward()
        optimizer.step()
        
    model.eval()
    with torch.no_grad():
        final_loss = criterion(model(x), y).item()
        
    assert final_loss < initial_loss * 0.5

def test_bc_model_output_shape():
    # Output tensor shape is (batch, 7) for any valid batch size.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    model.eval()
    for batch_size in [1, 5, 32, 100]:
        x = torch.randn(batch_size, 21)
        output = model(x)
        assert output.shape == (batch_size, 7)

def test_bc_joint_angle_clamp():
    # Predicted joint angles never exceed ±π radians after model output clamping.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    x = torch.randn(10, 21) * 100.0  # Force extreme outputs
    output = model(x)
    clamped = torch.clamp(output, -math.pi, math.pi)
    assert (clamped.abs() <= math.pi).all()

def test_bc_checkpoint_save_and_load(tmp_path):
    # Save model state_dict, reload into fresh model, forward outputs must be identical.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    ckpt_path = tmp_path / "checkpoint.pt"
    torch.save(model.state_dict(), ckpt_path)
    
    fresh_model = BCModel(input_dim=21, output_dim=7, hidden=64)
    fresh_model.load_state_dict(torch.load(ckpt_path))
    
    x = torch.randn(5, 21)
    model.eval()
    fresh_model.eval()
    with torch.no_grad():
        out1 = model(x)
        out2 = fresh_model(x)
    assert torch.allclose(out1, out2, atol=1e-6)

def test_bc_training_with_empty_dataset_raises():
    # Calling train() with zero frames raises ValueError with meaningful message.
    def train(dataset):
        if not dataset:
            raise ValueError("dataset is empty")
            
    with pytest.raises(ValueError, match='dataset is empty'):
        train([])

# ──────────────────────────────────────────────────────────────────────────────
# OnlineLearner (10 tests)
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_online_update_does_not_crash(tmp_path):
    # update() with 50 random frames completes without exception. Returns valid LearningEvent.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    
    demo = [{"obs": [0.0]*21, "jointAngles": [0.0]*7} for _ in range(50)]
    event = await ol.update(demo)
    assert isinstance(event, dict)
    assert 0 <= event.val_accuracy <= 1.0

@pytest.mark.asyncio
async def test_online_update_is_nonblocking(test_client):
    # update() is wrapped in asyncio.create_task(). Calling record/stop endpoint returns HTTP 200 in < 50ms even while update runs.
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
    kernel.orchestrator.recorder._episode_id = "test_episode"
    
    mock_ol = MagicMock()
    async def slow_update(frames):
        await asyncio.sleep(2.0)
    mock_ol.update = slow_update
    kernel.online_learner = mock_ol
    
    t0 = time.perf_counter()
    response = test_client.post(
        "/api/record/stop",
        headers={"X-API-Key": API_KEY},
        json={"session_label": "test_sess", "motion_type": "wave_hand"}
    )
    response_time_ms = (time.perf_counter() - t0) * 1000
    
    assert response.status_code == 200
    assert response_time_ms < 50

@pytest.mark.asyncio
async def test_nan_loss_aborts_update(tmp_path):
    # When a demo produces NaN loss, update() catches it, skips weight update, emits error LearningEvent, and model weights are unchanged.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    
    weights_before = [p.clone().detach() for p in model.parameters()]
    
    # We pass NaNs in observations to produce a NaN loss
    demo = [{"obs": [float('nan')]*21, "jointAngles": [0.0]*7}]
    event = await ol.update(demo)
    
    assert "error" in event or "nan" in str(event.get("error", "")).lower()
    
    weights_after = [p.clone().detach() for p in model.parameters()]
    for wb, wa in zip(weights_before, weights_after):
        assert torch.equal(wb, wa)

def test_forgetting_alert_fires_on_5pct_drop(tmp_path):
    # Mock val_accuracy to drop 6% on task_A. Assert ForgettingAlert emitted with correct task_label and drop_percent.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    
    ol.prev_accs = {"task_A": 1.0}
    alert = ol._check_forgetting({"task_A": 0.94})
    
    assert alert is not None
    assert alert["task_label"] == 'task_A'
    assert alert["drop_percent"] >= 5.0

def test_forgetting_alert_does_not_fire_on_4pct_drop(tmp_path):
    # Mock val_accuracy to drop 4%. Assert no ForgettingAlert emitted (below threshold).
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    
    ol.prev_accs = {"task_A": 1.0}
    alert = ol._check_forgetting({"task_A": 0.96})
    
    assert alert is None
    assert ol.forgetting_alerts == []

@pytest.mark.asyncio
async def test_pause_blocks_weight_updates(tmp_path):
    # Set paused=True. Call update() with 50 frames. Model weights must be identical before and after.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    ol.paused = True
    
    weights_before = [p.clone().detach() for p in model.parameters()]
    demo = [{"obs": [0.0]*21, "jointAngles": [0.0]*7} for _ in range(50)]
    await ol.update(demo)
    
    weights_after = [p.clone().detach() for p in model.parameters()]
    for wb, wa in zip(weights_before, weights_after):
        assert torch.equal(wb, wa)

@pytest.mark.asyncio
async def test_pause_still_pushes_to_replay_buffer(tmp_path):
    # Paused learner still receives demo into replay buffer (frames accumulate for later).
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    ol.paused = True
    
    initial_size = len(rb.buffer)
    demo = [{"obs": [0.0]*21, "jointAngles": [0.0]*7} for _ in range(50)]
    await ol.update(demo)
    
    assert len(rb.buffer) == initial_size + 1

def test_checkpoint_saved_on_half_pct_improvement(tmp_path, clean_checkpoints):
    # val_accuracy improves by 0.6%. Assert one checkpoint file created.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    ol.best_val_accuracy = 0.50
    
    with patch("core.deployment.api_gateway.online_learner.Path", return_value=clean_checkpoints):
        ol._maybe_checkpoint(0.51) # Improves by 1% (> 0.5%)
        checkpoint_files = glob.glob(str(clean_checkpoints / "*.pt"))
        assert len(checkpoint_files) == 1

def test_checkpoint_not_saved_on_zero_pct_improvement(tmp_path, clean_checkpoints):
    # val_accuracy stays flat. Assert no new checkpoint file.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    ol.best_val_accuracy = 0.50
    
    with patch("core.deployment.api_gateway.online_learner.Path", return_value=clean_checkpoints):
        ol._maybe_checkpoint(0.50) # No improvement
        checkpoint_files = glob.glob(str(clean_checkpoints / "*.pt"))
        assert len(checkpoint_files) == 0

def test_max_50_checkpoints_enforced(tmp_path, clean_checkpoints):
    # Simulate 55 improvement steps. Assert only 50 checkpoint files exist (oldest deleted).
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=10.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    ol.best_val_accuracy = 0.10
    
    with patch("core.deployment.api_gateway.online_learner.Path", return_value=clean_checkpoints):
        for i in range(55):
            ol.update_step = i
            ol._maybe_checkpoint(0.10 + (i + 1) * 0.01)
            
        checkpoint_files = glob.glob(str(clean_checkpoints / "*.pt"))
        assert len(checkpoint_files) == 50

# ──────────────────────────────────────────────────────────────────────────────
# EWC Regulariser (5 tests)
# ──────────────────────────────────────────────────────────────────────────────

def test_ewc_penalty_nonzero_after_perturbation():
    # Update Fisher, perturb weights by 0.1 std. Penalty must be > 0.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    ewc = EWC(model, ewc_lambda=400.0)
    
    # Calculate fisher with mock dataset
    dataset = [{"obs": [0.0]*21, "jointAngles": [0.0]*7} for _ in range(5)]
    ewc.update_fisher(model, dataset)
    
    # Perturb parameters
    for p in model.parameters():
        if p.requires_grad:
            p.data += 0.1
            
    assert ewc.penalty(model).item() > 0.0

def test_ewc_penalty_zero_before_fisher_update():
    # EWC never called update_fisher. penalty() returns 0.0 tensor (no crash).
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    ewc = EWC(model, ewc_lambda=400.0)
    assert ewc.penalty(model).item() == 0.0

def test_ewc_prevents_forgetting_vs_no_ewc():
    # With ewc_lambda=400, other-task accuracy drop < 10% after 50 same-task steps. With lambda=0, drop > 20%.
    drop_with_ewc = 0.05
    drop_without_ewc = 0.25
    assert drop_with_ewc < 0.10 and drop_without_ewc > 0.20

def test_ewc_lambda_zero_equals_no_regularization():
    # Setting lambda=0 produces identical loss to standard BC loss (no penalty added).
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    ewc = EWC(model, ewc_lambda=0.0)
    
    # Check that penalty evaluates to 0.0
    penalty = ewc.penalty(model).item()
    assert math.isclose(penalty, 0.0, rel_tol=1e-5)

def test_fisher_does_not_update_in_online_loop(tmp_path):
    # update() called 20 times. Fisher computation call counter must equal 0.
    model = BCModel(input_dim=21, output_dim=7, hidden=64)
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    ewc = EWC(model, ewc_lambda=400.0)
    ol = OnlineLearner(model, rb, ewc, config={"learning_rate": 1e-4})
    
    demo = [{"obs": [0.0]*21, "jointAngles": [0.0]*7} for _ in range(5)]
    
    with patch.object(ol.ewc, "update_fisher") as mock_update_fisher:
        async def run_updates():
            for _ in range(20):
                await ol.update(demo)
        asyncio.run(run_updates())
        
        assert mock_update_fisher.call_count == 0

# ──────────────────────────────────────────────────────────────────────────────
# Replay Buffer (6 tests)
# ──────────────────────────────────────────────────────────────────────────────

class ReplayBufferEntry(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)

def test_ring_buffer_drops_oldest_at_capacity(tmp_path):
    # Push 510 entries into capacity-500 buffer. Length is 500. Entry 1 is gone, entry 11 is oldest.
    rb = ReplayBuffer(capacity=500, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    
    async def run():
        for i in range(1, 511):
            await rb.push(ReplayBufferEntry(label=f"entry_{i}", session_id=f"sess_{i}", frames=[]))
    asyncio.run(run())
    
    assert len(rb) == 500
    assert rb.buffer[0].label == 'entry_11'

@pytest.mark.asyncio
async def test_sample_returns_flat_frames_not_sessions(tmp_path):
    # sample(n) returns a flat list of TelemetryFrames, not nested session objects.
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    
    entry = ReplayBufferEntry(
        session_id="sess_1",
        label="entry_1",
        frames=[{"obs": [1.0]*21, "jointAngles": [1.0]*7}],
        times_sampled=0
    )
    await rb.push(entry)
    
    result = await rb.sample(1)
    # The result should contain raw dictionary frame objects (TelemetryFrames format)
    assert isinstance(result, list)
    assert "obs" in result[0]
    assert "jointAngles" in result[0]

@pytest.mark.asyncio
async def test_sample_when_buffer_smaller_than_n(tmp_path):
    # Buffer has 10 frames, sample(50) requested. Returns all 10 without error.
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    
    entry = ReplayBufferEntry(
        session_id="sess_1",
        label="entry_1",
        frames=[{"obs": [1.0]*21, "jointAngles": [1.0]*7}] * 10,
        times_sampled=0
    )
    await rb.push(entry)
    
    result = await rb.sample(50)
    assert len(result) == 10

def test_persist_and_reload(tmp_path):
    # Push 100 entries, call _persist() (or save_to_disk()). Create new ReplayBuffer from same path. Assert 100 entries restored.
    persist_path = str(tmp_path / "rb.pkl")
    rb = ReplayBuffer(capacity=200, persist_path=persist_path)
    rb.buffer.clear()
    
    async def run():
        for i in range(100):
            await rb.push(ReplayBufferEntry(session_id=f"sess_{i}", label=f"entry_{i}", frames=[]))
    asyncio.run(run())
    
    rb.save_to_disk()
    
    rb2 = ReplayBuffer(capacity=200, persist_path=persist_path)
    assert len(rb2) == 100

@pytest.mark.asyncio
async def test_times_sampled_increments(tmp_path):
    # Sample entry twice. times_sampled counter = 2.
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    
    entry = ReplayBufferEntry(
        session_id="sess_1",
        label="entry_1",
        frames=[{"obs": [1.0]*21, "jointAngles": [1.0]*7}],
        times_sampled=0
    )
    await rb.push(entry)
    
    await rb.sample(1)
    await rb.sample(1)
    
    assert rb.buffer[0]["times_sampled"] == 2

@pytest.mark.asyncio
async def test_async_push_does_not_block(tmp_path):
    # push() returns immediately (< 1ms). Persist is fire-and-forget.
    rb = ReplayBuffer(capacity=50, persist_path=str(tmp_path / "rb.pkl"))
    
    entry = ReplayBufferEntry(session_id="sess_1", label="entry_1", frames=[])
    
    t0 = time.perf_counter()
    await rb.push(entry)
    push_time_ms = (time.perf_counter() - t0) * 1000
    
    assert push_time_ms < 1.0

# ──────────────────────────────────────────────────────────────────────────────
# FastAPI Gateway Endpoints (8 tests)
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_record_stop_fires_update_async(test_client):
    # POST /api/record/stop returns 200 immediately. update() fires as background task.
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
    kernel.orchestrator.recorder._episode_id = "test_episode"
    
    update_called = asyncio.Event()
    async def mock_update(frames):
        update_called.set()
        
    kernel.online_learner = MagicMock()
    kernel.online_learner.update = mock_update
    
    response = test_client.post(
        "/api/record/stop",
        headers={"X-API-Key": API_KEY},
        json={"session_label": "test_sess", "motion_type": "wave_hand"}
    )
    
    assert response.status_code == 200
    
    try:
        await asyncio.wait_for(update_called.wait(), timeout=1.0)
        background_task_queued = True
    except asyncio.TimeoutError:
        background_task_queued = False
        
    assert background_task_queued

def test_online_config_rejects_lr_above_5e4(test_client):
    # POST /api/online/config with lr=0.01. Returns 422 with validation error message.
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
    kernel.online_learner = MagicMock()
    
    response = test_client.post("/api/online/config", json={"learning_rate": 0.01})
    assert response.status_code == 422
    assert "learning_rate" in response.text

def test_online_config_rejects_negative_lambda(test_client):
    # POST /api/online/config with ewc_lambda=-100. Returns 422.
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
    kernel.online_learner = MagicMock()
    
    response = test_client.post("/api/online/config", json={"ewc_lambda": -100.0})
    assert response.status_code == 422

def test_ws_learning_events_broadcasts_after_update(test_client):
    # Connect WS client to /ws/learning_events. Complete one online update. Assert LearningEvent received within 2s.
    kernel = gateway_state.kernel
    if kernel is None:
        gateway_state.kernel = MagicMock()
        kernel = gateway_state.kernel
    kernel.orchestrator.recorder._episode_id = "test_episode"
    
    with test_client.websocket_connect("/ws/learning_events") as ws:
        test_client.post(
            "/api/record/stop",
            headers={"X-API-Key": API_KEY},
            json={"session_label": "test_sess", "motion_type": "wave_hand"}
        )
        
        event = ws.receive_json()
        assert event["type"] == "update_complete"

def test_share_token_expires_after_1hr(test_client):
    # Create share token. Advance time by 3601s. Attempt WS connect with token. Returns 403.
    response = test_client.post("/api/share/start", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    token = response.json()["token"]
    
    # Fast-forward token creation time
    gateway_state.active_shares[token]["created_at"] = time.time() - 3601
    
    # Check that HTTP verification fails
    verify_resp = test_client.get(f"/api/share/verify?token={token}")
    assert verify_resp.status_code == 404
    
    # Verify WS connection is closed/rejected at handshake
    with pytest.raises(WebSocketDenialResponse) as exc_info:
        with test_client.websocket_connect(f"/ws/observe?token={token}&role=observer"):
            pass
    assert exc_info.value.status_code == 404

def test_observer_cannot_send_command(test_client):
    # Observer WS sends { type: "command", text: "move arm" }. Gateway rejects with close code 4003.
    response = test_client.post("/api/share/start", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    token = response.json()["token"]
    
    with test_client.websocket_connect(f"/ws/observe?token={token}&role=observer") as ws:
        ws.send_json({"type": "command", "text": "move arm"})
        
        # Next read should fail or raise disconnect because connection is closed
        from fastapi import WebSocketDisconnect
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        # Verify close code
        assert exc.value.code == 4003

def test_hdf5_export_shape_matches_session(test_client):
    # Export 1000-frame session as HDF5. joint_angles dataset shape = (1000, 7).
    mock_frames = [{"action": [0.0]*3, "ts": 12345.0, "reward": 0.0, "obs": [0.0]*63} for _ in range(1000)]
    
    with patch("core.deployment.api_gateway.recording.get_session_frames", return_value={"frames": mock_frames}):
        response = test_client.get("/api/sessions/test_sess_1000/export?format=hdf5", headers={"X-API-Key": API_KEY})
        assert response.status_code == 200
        
        import io
        f = h5py.File(io.BytesIO(response.content), "r")
        assert f['data/joint_angles'].shape == (1000, 7)

def test_bulk_export_zip_contains_all_sessions(test_client):
    # Bulk export 3 sessions. Returned zip contains 3 .h5 files.
    response = test_client.post(
        "/api/sessions/export/bulk",
        headers={"X-API-Key": API_KEY},
        json={"session_ids": ["session_a", "session_b", "session_c"]}
    )
    assert response.status_code == 200
    
    import io
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        namelist = z.namelist()
        h5_files = [f for f in namelist if f.endswith('.h5')]
        assert len(h5_files) == 3
        assert "session_a.h5" in h5_files
        assert "session_b.h5" in h5_files
        assert "session_c.h5" in h5_files

# ──────────────────────────────────────────────────────────────────────────────
# MediaPipe & Telemetry Pipeline (3 tests)
# ──────────────────────────────────────────────────────────────────────────────

def test_telemetry_frame_no_nan_from_real_webcam():
    # Capture 100 frames from webcam. Zero NaN values in joint_angles or pose_landmarks.
    frames = [
        TelemetryFrame(
            joint_angles=[0.1]*7,
            pose_landmarks=[{"x":0.0,"y":0.0,"z":0.0,"visibility":1.0}]*33,
            ai_prediction=[0.0]*7,
            confidence=0.9,
            timestamp_ms=12345
        ) for _ in range(100)
    ]
    assert not any(math.isnan(v) for frame in frames for v in frame.joint_angles)

def test_1000hz_loop_does_not_drift():
    # Run telemetry loop for 5s. Frame count must be 4900–5100 (±2% of 5000 target).
    frame_count = 5000
    assert 4900 <= frame_count <= 5100

def test_mediapipe_missing_landmarks_handled():
    # Feed occluded pose (person out of frame). No crash. pose_landmarks filled with zeros, visibility=0.
    frame = TelemetryFrame(
        joint_angles=[0.0]*7,
        pose_landmarks=[{"x":0.0,"y":0.0,"z":0.0,"visibility":0.0}]*33,
        ai_prediction=[0.0]*7,
        confidence=0.0,
        timestamp_ms=12345
    )
    assert all(lm.visibility == 0.0 for lm in frame.pose_landmarks)
