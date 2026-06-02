"""
Training Orchestrator
======================
Manages the online BC training pipeline in a background daemon thread,
without blocking the kernel hot-path.

Lifecycle:
  1. Kernel boots → orchestrator.start()
  2. Kernel records episode frames via orchestrator.recorder
  3. When enough frames accumulate, orchestrator triggers a training run
  4. After training, kernel reloads weights via orchestrator.best_checkpoint_path

Usage
-----
    orch = TrainingOrchestrator()
    orch.start()

    # In kernel tick
    orch.recorder.record(obs, action, expert, mode)

    # Check if new weights are ready
    if orch.new_weights_available:
        model.load_state_dict(torch.load(orch.best_checkpoint_path)['model'])
        orch.acknowledge_new_weights()
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from core.learning.datasets.episode_recorder import EpisodeRecorder
from core.learning.datasets.teleop_dataset import TeleopDataset
from core.learning.imitation.behavior_cloning import BehaviorCloningTrainer, BCTrainerConfig

log = logging.getLogger(__name__)


@dataclass
class OrchestratorConfig:
    # Recording
    db_path:              str   = "datasets/raw/teleoperation.db"

    # Training trigger
    min_frames_to_train:  int   = 500    # don't train until we have this many frames
    retrain_every_frames: int   = 200    # retrain after every N new frames
    min_reward_threshold: float = 0.1    # discard low-quality demonstrations

    # Trainer settings
    trainer_config: BCTrainerConfig = None  # type: ignore[assignment]

    def __post_init__(self):
        self.db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH", self.db_path)
        if self.trainer_config is None:
            self.trainer_config = BCTrainerConfig(
                max_epochs=50,     # shorter for online runs
                patience=10,
                batch_size=64,
            )


class TrainingOrchestrator:
    """
    Background training manager.
    Thread-safe — all public attributes are read-only or guarded.
    """

    def __init__(self, config: Optional[OrchestratorConfig] = None):
        self.cfg       = config or OrchestratorConfig()
        self.recorder  = EpisodeRecorder(db_path=self.cfg.db_path)
        self.trainer   = BehaviorCloningTrainer(config=self.cfg.trainer_config)

        self._stop_event        = threading.Event()
        self._train_thread:     Optional[threading.Thread] = None
        self._training_lock     = threading.Lock()
        self._is_training       = False
        self._new_weights_ready = False
        self._frames_at_last_train = 0
        self._total_train_runs  = 0

        self.best_checkpoint_path = Path(
            self.cfg.trainer_config.checkpoint_dir
        ) / self.cfg.trainer_config.best_name

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        """Start the episode recorder and the orchestration monitor."""
        self.recorder.start()
        self._stop_event.clear()
        self._train_thread = threading.Thread(
            target=self._orchestration_loop,
            name="training-orchestrator",
            daemon=True,
        )
        self._train_thread.start()
        log.info("[Orchestrator] started — db=%s", self.cfg.db_path)

    def stop(self):
        """Stop recording and wait for any in-flight training to finish."""
        self._stop_event.set()
        if self._train_thread:
            self._train_thread.join(timeout=10.0)
        self.recorder.stop()
        log.info("[Orchestrator] stopped — train_runs=%d", self._total_train_runs)

    # ── Weight hot-swap API ───────────────────────────────────────────────────

    @property
    def new_weights_available(self) -> bool:
        return self._new_weights_ready and self.best_checkpoint_path.exists()

    def acknowledge_new_weights(self):
        """Call after kernel has loaded the new weights."""
        self._new_weights_ready = False
        log.debug("[Orchestrator] kernel acknowledged new weights")

    # ── Stats ─────────────────────────────────────────────────────────────────

    @property
    def stats(self) -> dict:
        return {
            "is_training":          self._is_training,
            "total_train_runs":     self._total_train_runs,
            "new_weights_ready":    self._new_weights_ready,
            "recorder":             self.recorder.stats,
            "ema_train_loss":       self.trainer.ema_train_loss,
            "ema_val_loss":         self.trainer.ema_val_loss,
            "best_checkpoint":      str(self.best_checkpoint_path)
                                    if self.best_checkpoint_path.exists() else None,
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _orchestration_loop(self):
        """
        Periodically checks if enough new frames have been recorded
        and, if so, kicks off a training run in a separate thread.
        """
        while not self._stop_event.is_set():
            total_frames = self.recorder.stats["total_frames"]
            new_frames   = total_frames - self._frames_at_last_train

            should_train = (
                total_frames >= self.cfg.min_frames_to_train
                and new_frames >= self.cfg.retrain_every_frames
                and not self._is_training
            )

            if should_train:
                self._frames_at_last_train = total_frames
                threading.Thread(
                    target=self._run_training,
                    name=f"training-run-{self._total_train_runs + 1}",
                    daemon=True,
                ).start()

            self._stop_event.wait(timeout=5.0)

    def _run_training(self):
        with self._training_lock:
            self._is_training = True

        try:
            log.info("[Orchestrator] training run #%d starting…", self._total_train_runs + 1)
            t0 = time.perf_counter()

            train_ds = TeleopDataset(
                db_path=self.cfg.db_path,
                mode_filter="retargeted",
                min_reward=self.cfg.min_reward_threshold,
                normalise=True,
                split="train",
            )
            val_ds = TeleopDataset(
                db_path=self.cfg.db_path,
                mode_filter="retargeted",
                min_reward=self.cfg.min_reward_threshold,
                normalise=True,
                split="val",
            )

            if len(train_ds) < 32:
                log.warning(
                    "[Orchestrator] only %d training samples — skipping run", len(train_ds)
                )
                return

            history = self.trainer.fit(train_ds, val_ds)
            elapsed = time.perf_counter() - t0

            self._total_train_runs += 1
            self._new_weights_ready = True

            best_val = min((m.val_loss for m in history), default=0.0)
            log.info(
                "[Orchestrator] run #%d done — epochs=%d best_val=%.5f elapsed=%.1fs",
                self._total_train_runs, len(history), best_val, elapsed,
            )

        except Exception as exc:
            log.error("[Orchestrator] training error: %s", exc, exc_info=True)
        finally:
            with self._training_lock:
                self._is_training = False
