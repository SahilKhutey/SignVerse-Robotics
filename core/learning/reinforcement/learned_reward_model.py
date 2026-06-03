import torch
import torch.nn as nn
import torch.optim as optim
from typing import List, Dict, Any, Tuple
import numpy as np

class LearnedRewardModel(nn.Module):
    def __init__(self, sequence_length: int = 128, action_dim: int = 3):
        super(LearnedRewardModel, self).__init__()
        self.seq_len = sequence_length
        self.action_dim = action_dim
        self.input_dim = sequence_length * action_dim

        self.net = nn.Sequential(
            nn.Linear(self.input_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 1)
        )

    def forward(self, traj: torch.Tensor) -> torch.Tensor:
        """
        Inputs:
            traj: [Batch, SeqLen, ActionDim] or [Batch, InputDim]
        Outputs:
            reward: [Batch, 1] scalar reward score
        """
        if len(traj.shape) == 3:
            traj = traj.view(traj.shape[0], -1)
        return self.net(traj)

    def predict_reward_numpy(self, traj_np: np.ndarray) -> float:
        """Helper to get a float reward from a trajectory numpy array."""
        self.eval()
        with torch.no_grad():
            # Pad or truncate to seq_len
            if len(traj_np) < self.seq_len:
                pad_len = self.seq_len - len(traj_np)
                traj_np = np.pad(traj_np, ((0, pad_len), (0, 0)), 'edge')
            elif len(traj_np) > self.seq_len:
                traj_np = traj_np[:self.seq_len]
                
            tensor = torch.tensor(traj_np, dtype=torch.float32).unsqueeze(0)
            reward = self.forward(tensor)
            return float(reward.item())

def compute_bradley_terry_loss(
    r_a: torch.Tensor,
    r_b: torch.Tensor,
    preference: torch.Tensor
) -> torch.Tensor:
    """
    Computes Bradley-Terry preference loss.
    r_a, r_b: [Batch, 1] reward outputs
    preference: [Batch, 1] where 1.0 = prefer A, 0.0 = prefer B, 0.5 = Tie (draw)
    """
    prob_a_preferred = torch.sigmoid(r_a - r_b)
    prob_b_preferred = torch.sigmoid(r_b - r_a)

    # Cross-entropy loss components
    loss_a = -preference * torch.log(prob_a_preferred + 1e-8)
    loss_b = -(1.0 - preference) * torch.log(prob_b_preferred + 1e-8)
    
    return torch.mean(loss_a + loss_b)

def train_reward_model(
    model: LearnedRewardModel,
    preference_pairs: List[Dict[str, Any]],
    epochs: int = 15,
    lr: float = 1e-3
) -> List[Dict[str, float]]:
    """
    preference_pairs is a list of dicts:
        {
            "traj_a": np.ndarray [Seq, Dim],
            "traj_b": np.ndarray [Seq, Dim],
            "preference": float (1.0 = prefer A, 0.0 = prefer B, 0.5 = Tie)
        }
    """
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    history = []

    # Format dataset
    trajs_a = []
    trajs_b = []
    prefs = []

    for pair in preference_pairs:
        t_a = pair["traj_a"]
        t_b = pair["traj_b"]

        # Resample trajectories to fixed sequence length
        def resample(t: np.ndarray, target_len: int) -> np.ndarray:
            curr_len = len(t)
            if curr_len == 0:
                return np.zeros((target_len, model.action_dim))
            # Linear interpolation indices
            indices = np.linspace(0, curr_len - 1, target_len)
            resampled = np.zeros((target_len, t.shape[1] if len(t.shape) > 1 else 1))
            for dim in range(resampled.shape[1]):
                y = t[:, dim] if len(t.shape) > 1 else t
                resampled[:, dim] = np.interp(indices, np.arange(curr_len), y)
            return resampled

        t_a = resample(t_a, model.seq_len)
        t_b = resample(t_b, model.seq_len)

        trajs_a.append(t_a)
        trajs_b.append(t_b)
        prefs.append([pair["preference"]])

    if not trajs_a:
        return [{"train_loss": 0.0, "val_loss": 0.0}]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # Convert to PyTorch tensors
    tensor_a = torch.tensor(np.array(trajs_a), dtype=torch.float32).to(device)
    tensor_b = torch.tensor(np.array(trajs_b), dtype=torch.float32).to(device)
    tensor_pref = torch.tensor(np.array(prefs), dtype=torch.float32).to(device)

    # 80/20 train/val split
    split_idx = int(0.8 * len(preference_pairs))
    if split_idx == 0:
        split_idx = len(preference_pairs)

    train_a, val_a = tensor_a[:split_idx], tensor_a[split_idx:]
    train_b, val_b = tensor_b[:split_idx], tensor_b[split_idx:]
    train_pref, val_pref = tensor_pref[:split_idx], tensor_pref[split_idx:]

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        
        r_a = model(train_a)
        r_b = model(train_b)
        
        loss = compute_bradley_terry_loss(r_a, r_b, train_pref)
        loss.backward()
        optimizer.step()

        # Evaluate validation
        model.eval()
        val_loss = 0.0
        if len(val_pref) > 0:
            with torch.no_grad():
                vr_a = model(val_a)
                vr_b = model(val_b)
                val_loss = float(compute_bradley_terry_loss(vr_a, vr_b, val_pref).item())
        else:
            val_loss = float(loss.item())

        history.append({
            "epoch": epoch + 1,
            "train_loss": float(loss.item()),
            "val_loss": val_loss
        })

    return history
