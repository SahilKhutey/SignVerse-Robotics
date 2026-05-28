import pytest
import torch
from core.learning.policy.policy_network import PolicyNetwork
from core.learning.imitation.behavior_cloning import BehaviorCloningTrainer

def test_policy_forward_pass():
    # 10 input dims, 4 output dims
    policy = PolicyNetwork(state_dim=10, action_dim=4, hidden_dim=32)
    
    # Create mock batch of 5 states
    mock_states = torch.randn(5, 10)
    
    # Predict
    actions = policy(mock_states)
    
    assert actions.shape == (5, 4)
    assert not torch.isnan(actions).any()

def test_behavior_cloning_training_step():
    policy = PolicyNetwork(state_dim=10, action_dim=4, hidden_dim=32)
    trainer = BehaviorCloningTrainer(policy, learning_rate=0.01)
    
    mock_states = torch.randn(5, 10)
    expert_actions = torch.randn(5, 4)
    
    # Initial loss
    initial_loss = trainer.train_step(mock_states, expert_actions)
    assert isinstance(initial_loss, float)
    
    # Run a few more steps to ensure convergence is mathematically decreasing
    for _ in range(5):
        loss = trainer.train_step(mock_states, expert_actions)
        
    assert loss < initial_loss

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_learning_build.py"])
