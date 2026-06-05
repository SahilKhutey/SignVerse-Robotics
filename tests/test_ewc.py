import pytest
import torch
import torch.nn as nn
from unittest.mock import MagicMock, patch
import asyncio
from core.ewc import EWC
from core.online_learner import OnlineLearner
from core.replay_buffer import ReplayBuffer

def test_penalty_zero_before_fisher_update(bc_model):
    ewc = EWC(bc_model, ewc_lambda=400.0)
    # penalty before any update_fisher should be 0.0
    penalty = ewc.penalty(bc_model)
    assert isinstance(penalty, torch.Tensor)
    assert penalty.item() == 0.0

def test_penalty_nonzero_after_perturbation(bc_model, fake_frames):
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    # Format fake frames for fisher calculation
    dataset = []
    for f in fake_frames:
        dataset.append({
            "obs": f.joint_angles * 3, # shape 21
            "jointAngles": f.joint_angles
        })
        
    ewc.update_fisher(bc_model, dataset)
    
    # Perturb all params by +0.1
    for p in bc_model.parameters():
        if p.requires_grad:
            p.data += 0.1
            
    penalty = ewc.penalty(bc_model)
    assert penalty.item() > 0.0

def test_penalty_proportional_to_lambda(bc_model, fake_frames):
    dataset = []
    for f in fake_frames:
        dataset.append({
            "obs": f.joint_angles * 3,
            "jointAngles": f.joint_angles
        })
        
    ewc_400 = EWC(bc_model, ewc_lambda=400.0)
    ewc_400.update_fisher(bc_model, dataset)
    
    # Perturb params
    for p in bc_model.parameters():
        if p.requires_grad:
            p.data += 0.05
            
    penalty_400 = ewc_400.penalty(bc_model).item()
    
    ewc_800 = EWC(bc_model, ewc_lambda=800.0)
    # copy parameters and fisher to ewc_800
    ewc_800.params = {k: v.clone() for k, v in ewc_400.params.items()}
    ewc_800.fisher = {k: v.clone() for k, v in ewc_400.fisher.items()}
    
    penalty_800 = ewc_800.penalty(bc_model).item()
    
    assert abs(penalty_800 - 2.0 * penalty_400) <= 0.01 * penalty_800

def test_fisher_not_called_twice_accidentally(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    # Format demo frames
    demo = []
    for f in fake_frames[:10]:
        demo.append({
            "obs": f.joint_angles * 3,
            "jointAngles": f.joint_angles
        })
        
    with patch.object(ol.ewc, 'update_fisher') as mock_update_fisher:
        async def run_updates():
            for _ in range(50):
                await ol.update(demo)
        asyncio.run(run_updates())
        
        # Should be called exactly 0 times during update steps
        mock_update_fisher.assert_not_called()

def test_ewc_penalty_no_nan(bc_model, fake_frames, tmp_path):
    rb = ReplayBuffer(capacity=10, persist_path=str(tmp_path / "rb.pkl"))
    rb.buffer.clear()
    ewc = EWC(bc_model, ewc_lambda=400.0)
    
    dataset = []
    for f in fake_frames:
        dataset.append({
            "obs": f.joint_angles * 3,
            "jointAngles": f.joint_angles
        })
    ewc.update_fisher(bc_model, dataset)
    
    ol = OnlineLearner(bc_model, rb, ewc, config={"learning_rate": 1e-4})
    
    demo = []
    for f in fake_frames[:10]:
        demo.append({
            "obs": f.joint_angles * 3,
            "jointAngles": f.joint_angles
        })
        
    async def run_updates():
        for step in range(100):
            await ol.update(demo)
            penalty = ol.ewc.penalty(ol.model)
            assert not torch.isnan(penalty).any()
            
    asyncio.run(run_updates())
