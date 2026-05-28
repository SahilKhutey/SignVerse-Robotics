import torch
import torch.nn as nn
import torch.optim as optim
from core.learning.policy.policy_network import PolicyNetwork

class BehaviorCloningTrainer:
    def __init__(self, policy: PolicyNetwork, learning_rate: float = 1e-3):
        self.policy = policy
        self.optimizer = optim.Adam(self.policy.parameters(), lr=learning_rate)
        self.criterion = nn.MSELoss()

    def train_step(self, states: torch.Tensor, expert_actions: torch.Tensor) -> float:
        """
        Executes one step of behavior cloning via backpropagation.
        """
        self.optimizer.zero_grad()
        
        # Forward Pass
        predicted_actions = self.policy(states)
        
        # Compute Loss
        loss = self.criterion(predicted_actions, expert_actions)
        
        # Backpropagate
        loss.backward()
        self.optimizer.step()
        
        return loss.item()
