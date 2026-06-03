import pytest
import os
import uuid
import torch
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient

from core.deployment.api_gateway.gateway import app, API_KEY
from core.learning.reinforcement.learned_reward_model import LearnedRewardModel, compute_bradley_terry_loss
from core.learning.reinforcement.ppo_fine_tuner import PPOFineTuner
from core.learning.models.behavior_cloning import BehaviorCloningMLP

client = None

@pytest.fixture(scope="module", autouse=True)
def setup_client():
    global client
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    tmp_dir = Path(".tmp_test_artifacts") / f"rlhf_{uuid.uuid4().hex}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = str(tmp_dir / "teleoperation.db")
    
    with TestClient(app) as c:
        client = c
        yield c
        
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

# ── PyTorch core model tests ──────────────────────────────────────────────────

def test_reward_model_forward():
    rm = LearnedRewardModel(sequence_length=128, action_dim=3)
    mock_batch = torch.randn(4, 128, 3)
    out = rm(mock_batch)
    assert out.shape == (4, 1)

def test_bradley_terry_loss():
    r_a = torch.tensor([[1.0], [2.0], [0.5]])
    r_b = torch.tensor([[0.5], [2.5], [0.5]])
    pref = torch.tensor([[1.0], [0.0], [0.5]])
    
    loss = compute_bradley_terry_loss(r_a, r_b, pref)
    assert isinstance(loss, torch.Tensor)
    assert not torch.isnan(loss)

def test_ppo_fine_tuner_computations():
    policy = BehaviorCloningMLP()
    rm = LearnedRewardModel(sequence_length=128, action_dim=3)
    tuner = PPOFineTuner(policy, rm, action_std=0.1)

    mean_ref = torch.tensor([[[0.1, 0.2, 0.3]]])
    mean_curr = torch.tensor([[[0.12, 0.18, 0.33]]])
    
    kl = tuner.compute_kl_divergence(mean_ref, mean_curr)
    assert kl.shape == (1, 1)
    assert kl.item() > 0.0

    action = torch.tensor([[[0.15, 0.22, 0.28]]])
    log_prob = tuner.compute_log_prob(mean_curr, action)
    assert log_prob.shape == (1, 1)

# ── API Endpoint Tests ────────────────────────────────────────────────────────

def test_preference_queue_endpoint():
    response = client.get("/api/rlhf/preference_queue", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "pair_id" in data
    assert "session_a" in data
    assert "session_b" in data
    assert "progress_percent" in data

def test_preference_submission():
    payload = {
        "session_a_id": "test_sess_a",
        "session_b_id": "test_sess_b",
        "rating": "A",
        "duration_ms": 4200
    }
    response = client.post("/api/rlhf/preference", headers={"X-API-Key": API_KEY}, json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "pair_id" in data

def test_preference_status_endpoint():
    response = client.get("/api/rlhf/preference_status", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "rated_count" in data
    assert "estimated_hours_remaining" in data
    assert "streak_days" in data
    assert "ready_for_training" in data

def test_trigger_rlhf_train_endpoint():
    response = client.post("/api/rlhf/train", headers={"X-API-Key": API_KEY}, json={"ppo_steps": 5, "kl_beta": 0.1})
    # If the kernel is online, it will accept and trigger training (200),
    # otherwise it will fail with service unavailable (503). Either is valid.
    assert response.status_code in {200, 503}
