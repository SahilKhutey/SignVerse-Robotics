import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import List, Dict, Any, Tuple, Callable
import copy

class PPOFineTuner:
    def __init__(
        self,
        policy: nn.Module,
        reward_model: nn.Module,
        lr: float = 1e-5,
        kl_beta: float = 0.1,
        ppo_epochs: int = 4,
        clip_eps: float = 0.2,
        action_std: float = 0.1
    ):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Policy is the behavior cloning model we want to fine-tune
        self.policy = policy.to(self.device)
        self.reward_model = reward_model.to(self.device)
        
        # Reference policy is a frozen copy of the original BC weights
        self.ref_policy = copy.deepcopy(policy).to(self.device)
        self.ref_policy.eval()
        for p in self.ref_policy.parameters():
            p.requires_grad = False
            
        self.optimizer = optim.Adam(self.policy.parameters(), lr=lr)
        
        self.kl_beta = kl_beta
        self.ppo_epochs = ppo_epochs
        self.clip_eps = clip_eps
        
        # Policy action variance
        self.action_std = action_std
        self.log_std = np.log(action_std)
        self.action_var = action_std ** 2

    def compute_log_prob(self, mean: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        """Computes log probability of action under Gaussian distribution."""
        # mean shape: [Batch, SeqLen, ActionDim]
        # action shape: [Batch, SeqLen, ActionDim]
        variance = torch.tensor(self.action_var, dtype=torch.float32).to(self.device)
        log_prob = -((action - mean) ** 2) / (2 * variance) - 0.5 * np.log(2 * np.pi) - self.log_std
        return log_prob.sum(dim=-1) # sum over joint dims

    def compute_kl_divergence(self, mean_ref: torch.Tensor, mean_curr: torch.Tensor) -> torch.Tensor:
        """
        Computes analytical KL divergence between two Gaussians with identical variance.
        KL = 0.5 * ((mu_ref - mu_curr)^2 / var)
        """
        variance = self.action_var
        kl = 0.5 * ((mean_ref - mean_curr) ** 2) / variance
        return kl.sum(dim=-1) # sum over joint actions

    def fine_tune_step(
        self,
        trajectories: List[np.ndarray],  # list of observation sequences [Seq, ObsDim]
        progress_callback: Callable[[Dict[str, Any]], None] = None
    ) -> Dict[str, Any]:
        """
        Fine-tunes the policy using a PPO-style update over collected trajectory samples.
        """
        self.policy.train()
        
        # Prepare datasets
        obs_batches = []
        for traj in trajectories:
            # pad or truncate to 128
            if len(traj) < 128:
                pad_len = 128 - len(traj)
                traj = np.pad(traj, ((0, pad_len), (0, 0)), 'edge')
            else:
                traj = traj[:128]
            obs_batches.append(traj)

        if not obs_batches:
            return {"status": "error", "message": "No trajectories provided"}

        obs_tensor = torch.tensor(np.array(obs_batches), dtype=torch.float32).to(self.device)
        
        # 1. Rollout/generate actions and compute reference probabilities
        with torch.no_grad():
            # Get mean actions from current policy
            batch_size, seq_len, obs_dim = obs_tensor.shape
            
            # Policy forward pass expects [Batch*SeqLen, ObsDim]
            flat_obs = obs_tensor.view(-1, obs_dim)
            flat_means_curr = self.policy(flat_obs)
            means_curr = flat_means_curr.view(batch_size, seq_len, -1)
            
            # Get mean actions from reference policy
            flat_means_ref = self.ref_policy(flat_obs)
            means_ref = flat_means_ref.view(batch_size, seq_len, -1)
            
            # Sample actions around current policy to build PPO training batch
            noise = torch.randn_like(means_curr) * self.action_std
            actions = (means_curr + noise).detach()
            
            # Log probabilities
            old_log_probs = self.compute_log_prob(means_curr, actions).detach()
            
            # Predict rewards via Learned Reward Model
            # Reward model expects flattened trajectories: [Batch, SeqLen * ActionDim]
            rewards = self.reward_model(actions).view(-1).detach()
            
        # 2. PPO Optimization Loops
        running_ppo_loss = 0.0
        running_kl = 0.0
        aborted = False

        for ppo_epoch in range(self.ppo_epochs):
            self.optimizer.zero_grad()
            
            # Current policy pass
            flat_means = self.policy(flat_obs)
            means = flat_means.view(batch_size, seq_len, -1)
            
            log_probs = self.compute_log_prob(means, actions)
            
            # KL divergence from original BC policy
            kl_div = self.compute_kl_divergence(means_ref, means) # Shape: [Batch, SeqLen]
            mean_kl = kl_div.mean()
            
            # Hard-stop constraint guard
            if mean_kl.item() > 0.5:
                aborted = True
                break
                
            # Compute policy surrogate loss
            ratios = torch.exp(log_probs - old_log_probs)
            
            # Sequence level advantages (sequence reward minus value baseline)
            # Simple baseline: average reward of the batch
            baseline = rewards.mean()
            advantages = (rewards - baseline).unsqueeze(1) # Broadcast advantages over seq length
            
            surr1 = ratios * advantages
            surr2 = torch.clamp(ratios, 1.0 - self.clip_eps, 1.0 + self.clip_eps) * advantages
            
            # Policy loss (negative since we maximize) + KL penalty
            policy_loss = -torch.min(surr1, surr2).mean() + self.kl_beta * mean_kl
            
            policy_loss.backward()
            nn.utils.clip_grad_norm_(self.policy.parameters(), 0.5)
            self.optimizer.step()
            
            running_ppo_loss += policy_loss.item()
            running_kl += mean_kl.item()

            if progress_callback:
                progress_callback({
                    "step": ppo_epoch + 1,
                    "loss": policy_loss.item(),
                    "kl_divergence": mean_kl.item(),
                    "reward": rewards.mean().item()
                })

        if aborted:
            return {
                "status": "aborted",
                "message": "PPO training aborted: Policy drifted too far from safe BC baseline (KL > 0.5)",
                "kl": running_kl / (ppo_epoch if ppo_epoch > 0 else 1)
            }

        return {
            "status": "success",
            "loss": running_ppo_loss / self.ppo_epochs,
            "kl": running_kl / self.ppo_epochs,
            "reward": rewards.mean().item()
        }
