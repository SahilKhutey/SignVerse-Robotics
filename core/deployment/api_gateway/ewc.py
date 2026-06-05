import os
import torch
import torch.nn as nn
from pathlib import Path
from typing import Dict, List, Any

from core.os.utils.logger import setup_logger

logger = setup_logger("EWC")

class EWC:
    def __init__(self, model: nn.Module, ewc_lambda: float = 400.0):
        self.ewc_lambda = ewc_lambda
        self.params: Dict[str, torch.Tensor] = {}
        self.fisher: Dict[str, torch.Tensor] = {}
        # Pre-initialize snapshots to ensure attributes exist
        self._snapshot_params(model)

    def _snapshot_params(self, model: nn.Module):
        """Helper to clone current active weights."""
        self.params = {
            name: param.clone().detach()
            for name, param in model.named_parameters()
            if param.requires_grad
        }

    def update_fisher(self, model: nn.Module, dataset: List[Dict[str, Any]]):
        """Computes empirical Fisher Information Matrix diagonal over the given dataset.
        
        Called ONCE after the initial batch training.
        """
        logger.info(f"Computing EWC Fisher diagonal over {len(dataset)} baseline samples.")
        self._snapshot_params(model)
        
        # Initialize Fisher matrix diagonal with zeros
        self.fisher = {
            name: torch.zeros_like(param)
            for name, param in model.named_parameters()
            if param.requires_grad
        }

        if not dataset:
            logger.warning("Empty dataset passed for Fisher calculation. EWC penalty will evaluate to zero.")
            return

        model.eval()
        criterion = nn.MSELoss()
        device = next(model.parameters()).device

        count = 0
        for frame in dataset:
            obs_list = frame.get("obs")
            action_list = frame.get("jointAngles") or frame.get("action")
            if obs_list is None or action_list is None:
                continue

            obs = torch.tensor(obs_list, dtype=torch.float32).unsqueeze(0).to(device)

            model.zero_grad()
            pred = model(obs)
            # Sample z ~ N(0, I) to estimate the true Fisher information diagonal
            # via a single backward pass, avoiding vanishing gradients on well-fit targets.
            z = torch.randn_like(pred)
            loss = (pred * z).sum()
            loss.backward()

            for name, param in model.named_parameters():
                if param.requires_grad and param.grad is not None:
                    self.fisher[name] += param.grad.data.clone().pow(2)
            count += 1

        if count > 0:
            for name in self.fisher:
                self.fisher[name] /= count
            logger.info(f"EWC Fisher diagonal calculation finished. Accumulated over {count} frames.")
        else:
            logger.warning("No valid frames could be compiled for Fisher diagonal. Resetting.")
            self.fisher = {}

    def penalty(self, model: nn.Module) -> torch.Tensor:
        """Returns the quadratic EWC penalty representing weight drift constraint."""
        if not self.fisher or not self.params:
            return torch.tensor(0.0, device=next(model.parameters()).device)

        penalty_val = 0.0
        for name, param in model.named_parameters():
            if name in self.fisher and name in self.params:
                f = self.fisher[name].to(param.device)
                opt = self.params[name].to(param.device)
                penalty_val += (f * (param - opt).pow(2)).sum()

        return (self.ewc_lambda / 2.0) * penalty_val

    def save_fisher(self, filepath: str):
        """Persists the computed Fisher matrix and optimal parameters to a file."""
        try:
            path = Path(filepath)
            path.parent.mkdir(parents=True, exist_ok=True)
            torch.save({
                "fisher": self.fisher,
                "params": self.params,
                "ewc_lambda": self.ewc_lambda
            }, path)
            logger.info(f"EWC parameters saved successfully: {filepath}")
        except Exception as e:
            logger.error(f"Failed to save EWC parameters: {e}")

    def load_fisher(self, filepath: str) -> bool:
        """Loads EWC parameters from a file if it exists."""
        path = Path(filepath)
        if path.exists():
            try:
                data = torch.load(path, map_location="cpu")
                self.fisher = data.get("fisher", {})
                self.params = data.get("params", {})
                self.ewc_lambda = data.get("ewc_lambda", self.ewc_lambda)
                logger.info(f"EWC parameters loaded successfully: {filepath}")
                return True
            except Exception as e:
                logger.error(f"Failed to load EWC parameters: {e}")
        return False
