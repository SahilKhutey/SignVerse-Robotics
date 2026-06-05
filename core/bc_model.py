import torch
import torch.nn as nn

class BCModel(nn.Module):
    def __init__(self, input_dim=21, output_dim=7, hidden=64):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.ReLU(),
            nn.BatchNorm1d(hidden),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.BatchNorm1d(hidden),
            nn.Linear(hidden, output_dim)
        )

    def forward(self, x):
        return self.network(x)
