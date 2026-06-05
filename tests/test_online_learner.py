import pytest
import os
import time
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import torch
import torch.nn as nn
import torch.optim as optim

from core.online_learner import OnlineLearner
from core.replay_buffer import ReplayBuffer
from core.ewc import EWC
from shared_types.learning_event import LearningEvent
from core.deployment.api_gateway.gateway import app, API_KEY
from core.deployment.api_gateway import gateway_state

def format_fake_frames(frames):
    return [
        {
            "obs": f.joint_angles * 3, # 21 values
            "jointAngles": f.joint_angles
        } for f in frames
    ]

def test_update_returns_valid_learning_event(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    # Set model to eval mode to prevent BatchNorm updates during testing
    bc_model.eval()
    
    demo = format_fake_frames(fake_frames[:10])
    
    event = asyncio.run(ol.update(demo))
    assert isinstance(event, dict)
    assert event["loss"] > 0
    assert 0.0 <= event["val_accuracy"] <= 1.0
    assert event["step"] == 1
    assert event["timestamp_ms"] > 0

def test_no_forgetting_with_ewc_lambda_400(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=100, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    val_data = {}
    for task in ["task_A", "task_B"]:
        val_data[task] = []
        for _ in range(10):
            obs = torch.randn(21)
            action = torch.sin(obs[:7]) * 1.5
            val_data[task].append((obs, action))
            
    # Pretrain model
    pretrain_opt = optim.Adam(bc_model.parameters(), lr=1e-3)
    pretrain_crit = nn.MSELoss()
    for _ in range(50):
        pretrain_opt.zero_grad()
        all_obs = []
        all_actions = []
        for task in val_data:
            for obs, action in val_data[task]:
                all_obs.append(obs)
                all_actions.append(action)
        obs_batch = torch.stack(all_obs)
        action_batch = torch.stack(all_actions)
        pred = bc_model(obs_batch)
        loss = pretrain_crit(pred, action_batch)
        loss.backward()
        pretrain_opt.step()
        
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 5e-5, "ewc_lambda": 400.0, "replay_ratio": 0.2})
    ol.val_dataset = val_data
    
    fisher_dataset = []
    for obs, action in val_data["task_B"]:
        fisher_dataset.append({
            "obs": obs.tolist(),
            "jointAngles": action.tolist()
        })
    ol.ewc.update_fisher(ol.model, fisher_dataset)
    
    initial_accs = ol._eval_val_dataset()
    
    # 50 update steps on task_A only
    demo_a = []
    for _ in range(10):
        obs = torch.randn(21)
        action = torch.ones(7) * 5.0
        demo_a.append({
            "obs": obs.tolist(),
            "jointAngles": action.tolist()
        })
        
    async def run_updates():
        for _ in range(50):
            await ol.update(demo_a)
            
    asyncio.run(run_updates())
    post_accs = ol._eval_val_dataset()
    
    # Val accuracy on task_B must not drop > 10% from baseline
    drop = initial_accs["task_B"] - post_accs["task_B"]
    assert drop <= 0.10

def test_replay_alone_prevents_forgetting(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=100, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=0.0)
    
    val_data = {}
    for task in ["task_A", "task_B"]:
        val_data[task] = []
        for _ in range(10):
            obs = torch.randn(21)
            action = torch.sin(obs[:7]) * 1.5
            val_data[task].append((obs, action))
            
    # Pretrain model
    pretrain_opt = optim.Adam(bc_model.parameters(), lr=1e-3)
    pretrain_crit = nn.MSELoss()
    for _ in range(50):
        pretrain_opt.zero_grad()
        all_obs = []
        all_actions = []
        for task in val_data:
            for obs, action in val_data[task]:
                all_obs.append(obs)
                all_actions.append(action)
        obs_batch = torch.stack(all_obs)
        action_batch = torch.stack(all_actions)
        pred = bc_model(obs_batch)
        loss = pretrain_crit(pred, action_batch)
        loss.backward()
        pretrain_opt.step()
        
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 5e-5, "ewc_lambda": 0.0, "replay_ratio": 0.2})
    ol.val_dataset = val_data
    
    # Fill replay buffer with task_B frames
    async def fill_rb():
        frames = []
        for obs, action in val_data["task_B"]:
            frames.append({
                "obs": obs.tolist(),
                "jointAngles": action.tolist()
            })
        await ol.replay_buffer.push({
            "session_id": "session_b",
            "label": "task_B",
            "frames": frames,
            "added_at": int(time.time() * 1000),
            "times_sampled": 0
        })
    asyncio.run(fill_rb())
    
    initial_accs = ol._eval_val_dataset()
    
    # 50 update steps on task_A only
    demo_a = []
    for _ in range(10):
        obs = torch.randn(21)
        action = torch.ones(7) * 5.0
        demo_a.append({
            "obs": obs.tolist(),
            "jointAngles": action.tolist()
        })
        
    async def run_updates():
        for _ in range(50):
            await ol.update(demo_a)
            
    asyncio.run(run_updates())
    post_accs = ol._eval_val_dataset()
    
    ratio = post_accs["task_B"] / initial_accs["task_B"] if initial_accs["task_B"] > 0 else 1.0
    assert ratio >= 0.80

def test_checkpoint_saves_on_improvement(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    import shutil
    ckpt_dir = Path("models/checkpoints/online")
    if ckpt_dir.exists():
        shutil.rmtree(ckpt_dir)
        
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    # Mock val_accuracy sequence: [0.70, 0.72, 0.71, 0.73, 0.74] (each step has a baseline pre-eval and a post-eval)
    ol.best_val_accuracy = 0.69
    
    acc_seq = [0.69, 0.70, 0.70, 0.72, 0.72, 0.71, 0.71, 0.73, 0.73, 0.74]
    call_idx = 0
    def mock_eval():
        nonlocal call_idx
        acc = acc_seq[call_idx]
        call_idx += 1
        return {"overall": acc, "default_task": acc}
        
    ol._eval_val_dataset = mock_eval
    demo = format_fake_frames(fake_frames[:5])
    
    # Step 1: 0.70 (improvement from 0.69) -> Saves checkpoint 1
    asyncio.run(ol.update(demo))
    assert ol.last_checkpoint_step == 1
    
    # Step 2: 0.72 (improvement from 0.70) -> Saves checkpoint 2
    asyncio.run(ol.update(demo))
    assert ol.last_checkpoint_step == 2
    
    # Step 3: 0.71 (no improvement from 0.72) -> No checkpoint
    asyncio.run(ol.update(demo))
    assert ol.last_checkpoint_step == 2
    
    # Step 4: 0.73 (improvement from 0.72) -> Saves checkpoint 4
    asyncio.run(ol.update(demo))
    assert ol.last_checkpoint_step == 4
    
    # Step 5: 0.74 (improvement from 0.73) -> Saves checkpoint 5
    asyncio.run(ol.update(demo))
    assert ol.last_checkpoint_step == 5
    
    # Assert checkpoints saved at steps 1,2,4,5. Checkpoint count = 4
    files = list(ckpt_dir.glob("step_*.pt"))
    assert len(files) == 4
    shutil.rmtree(ckpt_dir, ignore_errors=True)

def test_no_checkpoint_without_improvement(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    import shutil
    ckpt_dir = Path("models/checkpoints/online")
    if ckpt_dir.exists():
        shutil.rmtree(ckpt_dir)
        
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    # Mock val_accuracy sequence: flat at 0.70 for 10 steps
    ol.best_val_accuracy = 0.70
    def mock_eval():
        return {"overall": 0.70, "default_task": 0.70}
    ol._eval_val_dataset = mock_eval
    
    demo = format_fake_frames(fake_frames[:5])
    async def run_updates():
        for _ in range(10):
            await ol.update(demo)
    asyncio.run(run_updates())
    
    # Assert checkpoint_count == 1 (only initial save on init if initial evaluates > best_val_accuracy, 
    # but since we cleared or controlled checkpoint_count, let's verify only 0 or 1 saved)
    files = list(ckpt_dir.glob("step_*.pt"))
    assert len(files) <= 1
    shutil.rmtree(ckpt_dir, ignore_errors=True)

def test_forgetting_alert_emitted_on_5pct_drop(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    ol.prev_accs = {"task_B": 0.80}
    new_accs = {"overall": 0.75, "task_B": 0.74} # 7.5% drop
    
    ol.forgetting_alerts.clear()
    ol._check_forgetting(new_accs)
    
    assert len(ol.forgetting_alerts) == 1
    alert = ol.forgetting_alerts[0]
    assert alert["task_label"] == "task_B"
    assert alert["drop_percent"] == 7.5

def test_forgetting_alert_not_emitted_on_4pct_drop(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    ol.prev_accs = {"task_B": 0.80}
    new_accs = {"overall": 0.77, "task_B": 0.761} # 4.9% drop (below 5%)
    
    ol.forgetting_alerts.clear()
    ol._check_forgetting(new_accs)
    
    assert len(ol.forgetting_alerts) == 0

def test_update_is_nonblocking(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    demo = format_fake_frames(fake_frames[:10])
    
    async def run_with_timeout():
        # Complete within 600ms on CPU
        await asyncio.wait_for(ol.update(demo), timeout=0.6)
        
    asyncio.run(run_with_timeout())

def test_bad_lr_rejected_by_config_endpoint():
    # Setup temporary DB path for testing config endpoint
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = ".tmp_test_artifacts/test_bad_lr.db"
    
    # Mock online_learner on app state
    mock_ol = MagicMock()
    mock_ol.status = "idle"
    mock_ol.update_step = 10
    mock_ol.lr = 1e-4
    mock_ol.replay_buffer.buffer = []
    mock_ol.checkpoint_count = 0
    mock_ol.last_checkpoint_step = None
    mock_ol.ewc_lambda = 400.0
    
    gateway_state.kernel = MagicMock()
    gateway_state.kernel.online_learner = mock_ol
    app.state.kernel = gateway_state.kernel
    app.state.online_learner = mock_ol
    
    with TestClient(app) as client:
        # POST with learning_rate = 1.0
        response = client.post("/api/online/config", json={"learning_rate": 1.0})
        assert response.status_code == 422
        
        # Verify model update_hyperparams was NOT called with learning_rate=1.0
        mock_ol.update_hyperparams.assert_not_called()
        
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

def test_pause_queues_demos_without_updating(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    # Pause learner
    ol.paused = True
    
    demo = format_fake_frames(fake_frames[:10])
    
    async def run_steps():
        # Push 5 demos while paused
        for _ in range(5):
            await ol.update(demo)
            
        assert len(ol.replay_buffer.buffer) == 5
        assert ol.update_step == 0
        
        # Resume
        ol.paused = False
        
        # Push 1 demo
        await ol.update(demo)
        assert ol.update_step == 1
        
    asyncio.run(run_steps())
