"""
Online Behavior Cloning Trainer
=================================
Production-grade BC training loop with:

  - AdamW optimiser + cosine annealing LR schedule
  - Gradient clipping (max_norm=1.0)
  - Early stopping via validation MSE patience
  - Best-checkpoint saving (policy_best.pth / policy_latest.pth)
  - Per-epoch metrics: train_loss, val_loss, lr
  - EMA smoothing of loss curves
  - Thread-safe hot-reload: new model weights are written atomically so the
    kernel can load them without interrupting inference
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from core.learning.models.behavior_cloning import BehaviorCloningMLP

log = logging.getLogger(__name__)


# ── Config ────────────────────────────────────────────────────────────────────

@dataclass
class BCTrainerConfig:
    # Model dims — must match BehaviorCloningMLP defaults
    input_dim:      int   = 63
    hidden_dim:     int   = 256       # Upgraded from 128
    output_dim:     int   = 3

    # Optimiser
    learning_rate:  float = 3e-4
    weight_decay:   float = 1e-4
    grad_clip_norm: float = 1.0

    # Schedule: cosine annealing
    max_epochs:     int   = 200
    warmup_epochs:  int   = 5
    eta_min_lr:     float = 1e-6

    # Early stopping
    patience:       int   = 20        # epochs without val improvement
    min_delta:      float = 1e-5

    # DataLoader
    batch_size:     int   = 64
    num_workers:    int   = 0         # 0 = main process (safe on Windows)

    # Checkpoints
    checkpoint_dir: str   = "models/checkpoints"
    best_name:      str   = "policy_best.pth"
    latest_name:    str   = "policy_latest.pth"

    # EMA smoothing coefficient for loss reporting
    ema_alpha:      float = 0.1


# ── Metrics ───────────────────────────────────────────────────────────────────

@dataclass
class EpochMetrics:
    epoch:       int
    train_loss:  float
    val_loss:    float
    lr:          float
    elapsed_s:   float
    improved:    bool = False


# ── Trainer ───────────────────────────────────────────────────────────────────

class BehaviorCloningTrainer:
    """
    Online-capable BC trainer.

    Quick usage
    -----------
    trainer = BehaviorCloningTrainer()
    trainer.fit(train_dataset, val_dataset)

    Hot-swap weights into a running kernel
    --------------------------------------
    # After fit() completes, kernel loads:
    #   models/checkpoints/policy_best.pth
    """

    def __init__(self, config: Optional[BCTrainerConfig] = None):
        self.cfg     = config or BCTrainerConfig()
        self.ckpt_dir = Path(self.cfg.checkpoint_dir)
        self.ckpt_dir.mkdir(parents=True, exist_ok=True)

        self.model     = BehaviorCloningMLP(
            input_dim=self.cfg.input_dim,
            hidden_dim=self.cfg.hidden_dim,
            output_dim=self.cfg.output_dim,
        )
        self.device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        self.optimizer = optim.AdamW(
            self.model.parameters(),
            lr=self.cfg.learning_rate,
            weight_decay=self.cfg.weight_decay,
        )
        self.criterion = nn.MSELoss()
        self.history:  List[EpochMetrics] = []
        self._ema_train_loss: Optional[float] = None
        self._ema_val_loss:   Optional[float] = None

        log.info(
            "[BCTrainer] device=%s  model_params=%d  cfg=%s",
            self.device,
            sum(p.numel() for p in self.model.parameters()),
            self.cfg,
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def fit(self, train_dataset, val_dataset) -> List[EpochMetrics]:
        """
        Full training run.

        Parameters
        ----------
        train_dataset : TeleopDataset (split='train')
        val_dataset   : TeleopDataset (split='val')

        Returns
        -------
        List of EpochMetrics, one per epoch.
        """
        if len(train_dataset) == 0:
            log.warning("[BCTrainer] train dataset is empty — aborting fit()")
            return []

        train_loader = DataLoader(
            train_dataset,
            batch_size=self.cfg.batch_size,
            shuffle=True,
            num_workers=self.cfg.num_workers,
            drop_last=len(train_dataset) > self.cfg.batch_size,
            pin_memory=(self.device.type == "cuda"),
        )
        val_loader = DataLoader(
            val_dataset,
            batch_size=self.cfg.batch_size,
            shuffle=False,
            num_workers=self.cfg.num_workers,
            pin_memory=(self.device.type == "cuda"),
        ) if len(val_dataset) > 0 else None

        scheduler = self._build_scheduler(train_loader)
        best_val  = math.inf
        no_improve = 0

        log.info(
            "[BCTrainer] fit start — train=%d val=%d epochs=%d",
            len(train_dataset),
            len(val_dataset) if val_dataset else 0,
            self.cfg.max_epochs,
        )

        for epoch in range(1, self.cfg.max_epochs + 1):
            t0 = time.perf_counter()

            train_loss = self._train_epoch(train_loader)
            val_loss   = self._val_epoch(val_loader) if val_loader else train_loss

            scheduler.step()
            lr = self.optimizer.param_groups[0]["lr"]

            # EMA smoothed losses for reporting
            self._ema_train_loss = self._ema(self._ema_train_loss, train_loss)
            self._ema_val_loss   = self._ema(self._ema_val_loss,   val_loss)

            improved = (best_val - val_loss) > self.cfg.min_delta
            if improved:
                best_val   = val_loss
                no_improve = 0
                self._save_checkpoint(self.cfg.best_name)
            else:
                no_improve += 1

            self._save_checkpoint(self.cfg.latest_name)

            metrics = EpochMetrics(
                epoch=epoch,
                train_loss=train_loss,
                val_loss=val_loss,
                lr=lr,
                elapsed_s=time.perf_counter() - t0,
                improved=improved,
            )
            self.history.append(metrics)

            log.info(
                "[BCTrainer] epoch=%3d  train=%.5f  val=%.5f  lr=%.2e  %s  %.2fs",
                epoch, train_loss, val_loss, lr,
                "★" if improved else " ",
                metrics.elapsed_s,
            )

            if no_improve >= self.cfg.patience:
                log.info(
                    "[BCTrainer] early stop at epoch=%d (no improvement for %d epochs)",
                    epoch, self.cfg.patience,
                )
                break

        log.info("[BCTrainer] fit complete — best_val=%.5f", best_val)
        return self.history

    def train_step(
        self,
        states:          torch.Tensor,
        expert_actions:  torch.Tensor,
    ) -> float:
        """
        Single gradient step — for online/incremental training.
        """
        self.model.train()
        states         = states.to(self.device)
        expert_actions = expert_actions.to(self.device)

        self.optimizer.zero_grad()
        pred = self.model(states)
        loss = self.criterion(pred, expert_actions)
        loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), self.cfg.grad_clip_norm)
        self.optimizer.step()
        return float(loss.item())

    def load_checkpoint(self, name: Optional[str] = None) -> bool:
        """Load weights from a checkpoint file into self.model."""
        path = self.ckpt_dir / (name or self.cfg.best_name)
        if not path.exists():
            log.warning("[BCTrainer] checkpoint not found: %s", path)
            return False
        # Register safe globals for weights_only=True (PyTorch >= 2.6)
        try:
            with torch.serialization.safe_globals([BCTrainerConfig]):
                state = torch.load(path, map_location=self.device, weights_only=True)
        except AttributeError:
            # Older PyTorch without safe_globals API
            state = torch.load(path, map_location=self.device, weights_only=False)
        self.model.load_state_dict(state["model"])
        log.info("[BCTrainer] loaded checkpoint: %s (epoch=%s)", path, state.get("epoch"))
        return True

    @property
    def ema_train_loss(self) -> float:
        return self._ema_train_loss or 0.0

    @property
    def ema_val_loss(self) -> float:
        return self._ema_val_loss or 0.0

    # ── Internal ───────────────────────────────────────────────────────────────

    def _train_epoch(self, loader: DataLoader) -> float:
        self.model.train()
        total_loss = 0.0
        n_batches  = 0

        for obs, labels in loader:
            obs    = obs.to(self.device)
            labels = labels.to(self.device)

            self.optimizer.zero_grad()
            pred = self.model(obs)
            loss = self.criterion(pred, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(self.model.parameters(), self.cfg.grad_clip_norm)
            self.optimizer.step()

            total_loss += loss.item()
            n_batches  += 1

        return total_loss / max(n_batches, 1)

    @torch.no_grad()
    def _val_epoch(self, loader: Optional[DataLoader]) -> float:
        if loader is None:
            return 0.0
        self.model.eval()
        total_loss = 0.0
        n_batches  = 0

        for obs, labels in loader:
            obs    = obs.to(self.device)
            labels = labels.to(self.device)
            pred   = self.model(obs)
            total_loss += self.criterion(pred, labels).item()
            n_batches  += 1

        return total_loss / max(n_batches, 1)

    def _build_scheduler(self, loader: DataLoader):
        """Warmup (linear) then cosine annealing."""
        total_steps  = self.cfg.max_epochs * len(loader)
        warmup_steps = self.cfg.warmup_epochs * len(loader)

        def lr_lambda(step: int) -> float:
            if step < warmup_steps:
                return step / max(warmup_steps, 1)
            progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
            cosine   = 0.5 * (1.0 + math.cos(math.pi * progress))
            eta_ratio = self.cfg.eta_min_lr / self.cfg.learning_rate
            return eta_ratio + (1.0 - eta_ratio) * cosine

        return optim.lr_scheduler.LambdaLR(self.optimizer, lr_lambda)

    def _save_checkpoint(self, name: str):
        path = self.ckpt_dir / name
        tmp  = path.with_suffix(".tmp")
        # Save cfg as a plain dict so weights_only=True loading works in PyTorch >= 2.6
        torch.save(
            {
                "model":   self.model.state_dict(),
                "epoch":   len(self.history),
                "cfg":     vars(self.cfg),
            },
            tmp,
        )
        tmp.replace(path)   # atomic on POSIX, best-effort on Windows

    def _ema(self, prev: Optional[float], new: float) -> float:
        if prev is None:
            return new
        alpha = self.cfg.ema_alpha
        return alpha * new + (1.0 - alpha) * prev
