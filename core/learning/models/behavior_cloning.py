import torch
import torch.nn as nn

class BehaviorCloningMLP(nn.Module):
    def __init__(self, input_dim=63, hidden_dim=128, output_dim=3):
        """
        A lightweight Multi-Layer Perceptron for Behavior Cloning.
        Maps 63-dimensional human hand landmarks (21 points * 3D) 
        to 3-dimensional robot joint angles (shoulder, elbow, wrist).
        """
        super(BehaviorCloningMLP, self).__init__()
        
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            
            nn.Linear(hidden_dim, output_dim)
        )

    def forward(self, x):
        """
        Forward pass.
        x: Tensor of shape (Batch_Size, input_dim)
        Returns: Tensor of shape (Batch_Size, output_dim)
        """
        return self.network(x)
