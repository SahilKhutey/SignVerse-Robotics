import os
import time
import glob
import math
import uuid
import sqlite3
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.deployment.api_gateway import gateway_state
from core.deployment.api_gateway.replay_buffer import ReplayBuffer
from core.deployment.api_gateway.ewc import EWC
from core.os.utils.logger import setup_logger

logger = setup_logger("OnlineLearner")

class LearningEvent(dict):
    """A dictionary subclass supporting dot attribute access."""
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)
            
    def __setattr__(self, name, value):
        self[name] = value

class OnlineLearner:
    def __init__(
        self,
        model: nn.Module,
        replay_buffer: Optional[ReplayBuffer] = None,
        ewc: Optional[EWC] = None,
        config: Optional[Dict[str, Any]] = None
    ):
        self.model = model
        
        # Default configuration
        if config is None:
            config = {}
        self.lr = config.get("learning_rate", 1e-4)
        self.ewc_lambda = config.get("ewc_lambda", 400.0)
        self.replay_ratio = config.get("replay_ratio", 0.2)

        # Lazy fallbacks to maintain backward compatibility with kernel instantiation
        if replay_buffer is None:
            replay_buffer = ReplayBuffer(persist_path="data/replay_buffer.pkl")
        self.replay_buffer = replay_buffer

        if ewc is None:
            ewc = EWC(self.model, ewc_lambda=self.ewc_lambda)
        self.ewc = ewc

        self.ewc.ewc_lambda = self.ewc_lambda
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        self.status = "idle"
        self.paused = False
        self.update_step = 0
        self.best_val_accuracy = 0.0
        self.checkpoint_count = 0
        self.last_checkpoint_step: Optional[int] = None
        self.last_batch_highlighted_indices: List[int] = []

        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=self.lr
        )
        self.criterion = nn.MSELoss()

        # Load held-out validation dataset
        self.val_dataset = self._load_val_dataset()
        self.prev_accs = self._eval_val_dataset()
        self.best_val_accuracy = self.prev_accs.get("overall", 0.0)

        # Forgetting Monitor tracking: task -> list of (step, accuracy)
        self.task_accuracies: Dict[str, List[Tuple[int, float]]] = {}
        self.forgetting_alerts: List[Dict[str, Any]] = []

        # Initialize history with step 0
        for task, acc in self.prev_accs.items():
            if task != "overall":
                self.task_accuracies[task] = [(0, acc)]
        
        # Track consecutive forgetting alerts for learning rate decay
        self.consecutive_alerts: Dict[str, int] = {}
        
        self.sync_checkpoint_count()

    def sync_checkpoint_count(self):
        """Syncs the saved checkpoints count."""
        ckpt_dir = Path("models/checkpoints/online")
        if ckpt_dir.exists():
            files = list(ckpt_dir.glob("step_*.pt"))
            self.checkpoint_count = len(files)

    def _load_val_dataset(self) -> Dict[str, List[Tuple[torch.Tensor, torch.Tensor]]]:
        """Loads a 10% held-out split from existing database sessions.
        
        Capped at 200 frames per task.
        Falls back to generating plausible mock validation data if DB is empty or missing.
        """
        db_path_str = os.environ.get("SIGNVERSE_TELEOP_DB_PATH", "data/teleoperation.db")
        db_path = Path(db_path_str)
        val_data = {}

        if db_path.exists():
            try:
                with sqlite3.connect(db_path) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute("SELECT id, session_id FROM episodes WHERE ended_at IS NOT NULL")
                    episodes = cursor.fetchall()
                    
                    for ep in episodes:
                        ep_id = ep["id"]
                        sess_id = ep["session_id"]
                        task_label = sess_id.split("_")[-1] if sess_id and "_" in sess_id else "default_task"

                        cursor.execute(
                            "SELECT obs_json, action_json FROM frames WHERE episode_id = ? AND mode = 'retargeted'",
                            (ep_id,)
                        )
                        frames = cursor.fetchall()
                        if not frames:
                            continue

                        val_count = max(1, int(len(frames) * 0.1))
                        val_count = min(val_count, 200)  # Cap at 200 frames
                        val_frames = frames[-val_count:]

                        if task_label not in val_data:
                            val_data[task_label] = []

                        for f in val_frames:
                            try:
                                obs = torch.tensor(json.loads(f["obs_json"]), dtype=torch.float32)
                                action = torch.tensor(json.loads(f["action_json"])[:3], dtype=torch.float32)
                                val_data[task_label].append((obs, action))
                            except Exception:
                                continue
            except Exception as e:
                logger.warning(f"Could not load validation dataset from DB: {e}")

        # Fallback to generating dummy data for tests
        if not val_data:
            logger.info("Validation dataset empty. Constructing synthetic validation splits.")
            # Dynamically check input dimension of model
            input_dim = 63
            for m in self.model.modules():
                if isinstance(m, nn.Linear):
                    input_dim = m.in_features
                    break
            
            # Also determine output dimension dynamically
            output_dim = 3
            for m in reversed(list(self.model.modules())):
                if isinstance(m, nn.Linear):
                    output_dim = m.out_features
                    break

            tasks = ["reach_left", "wave_hand", "grasp_block"]
            for task in tasks:
                val_data[task] = []
                for _ in range(20):
                    obs = torch.randn(input_dim)
                    action = torch.sin(obs[:output_dim]) * 1.5
                    val_data[task].append((obs, action))

        return val_data

    def _eval_val_dataset(self) -> Dict[str, float]:
        """Evaluates model performance under torch.no_grad() on held-out split.
        
        Returns per-task accuracy (1.0 - MSE) and overall validation accuracy.
        """
        self.model.eval()
        results = {}
        total_mse = 0.0
        total_count = 0

        with torch.no_grad():
            for task, data in self.val_dataset.items():
                if not data:
                    continue
                task_mse = 0.0
                for obs, action in data:
                    obs_t = obs.unsqueeze(0).to(self.device)
                    action_t = action.unsqueeze(0).to(self.device)
                    pred = self.model(obs_t)
                    task_mse += self.criterion(pred, action_t).item()
                
                avg_task_mse = task_mse / len(data)
                results[task] = float(max(0.0, 1.0 - avg_task_mse))
                total_mse += task_mse
                total_count += len(data)

        overall_mse = total_mse / total_count if total_count > 0 else 0.15
        results["overall"] = float(max(0.0, 1.0 - overall_mse))
        return results

    def _check_forgetting(self, new_accs: Dict[str, float]) -> Optional[Dict[str, Any]]:
        """Checks if task performance dropped by more than 5% since last step.
        
        Emits and records ForgettingAlert if drop is detected.
        """
        # Append new accuracies to history
        for task, new_acc in new_accs.items():
            if task != "overall":
                if task not in self.task_accuracies:
                    self.task_accuracies[task] = []
                self.task_accuracies[task].append((self.update_step, new_acc))

        alert = None
        for task, new_acc in new_accs.items():
            if task == "overall":
                continue
            if task in self.prev_accs:
                prev_acc = self.prev_accs[task]
                drop = prev_acc - new_acc
                rel_drop = drop / prev_acc if prev_acc > 0 else 0.0
                if rel_drop > 0.05:  # 5% relative threshold
                    alert = {
                        "task_label": task,
                        "accuracy_before": float(prev_acc),
                        "accuracy_after": float(new_acc),
                        "drop_percent": float(round(rel_drop * 100, 2)),
                        "step": int(self.update_step)
                    }
                    logger.warning(
                        f"FORGETTING DETECTED: '{task}' dropped from {prev_acc:.4f} to {new_acc:.4f} "
                        f"({drop*100:.2f}%) at step {self.update_step}!"
                    )
                    self.forgetting_alerts.append(alert)
                    break  # Emit first detected alert

        self.prev_accs = new_accs.copy()
        return alert

    def _maybe_checkpoint(self, val_acc: float) -> bool:
        """Saves a policy checkpoint if overall accuracy improves by > 0.5%.
        
        Maintains a rolling queue of up to 50 checkpoints.
        """
        if val_acc > self.best_val_accuracy + 0.005:
            self.best_val_accuracy = val_acc
            
            ckpt_dir = Path("models/checkpoints/online")
            ckpt_dir.mkdir(parents=True, exist_ok=True)
            path = ckpt_dir / f"step_{self.update_step}.pt"
            
            try:
                torch.save({
                    "model": self.model.state_dict(),
                    "step": self.update_step,
                    "accuracy": val_acc,
                    "lr": self.lr
                }, path)
                logger.info(f"Checkpoint saved on performance improvement: {path} (acc: {val_acc:.4f})")
                
                self.last_checkpoint_step = self.update_step
                self.sync_checkpoint_count()

                # Clean up excess checkpoints
                checkpoints = sorted(
                    list(ckpt_dir.glob("step_*.pt")),
                    key=os.path.getmtime
                )
                while len(checkpoints) > 50:
                    oldest = checkpoints.pop(0)
                    os.remove(oldest)
                return True
            except Exception as e:
                logger.error(f"Failed to save online checkpoint: {e}")
        return False

    def update_learning_rate(self, new_lr: float):
        """Sets a new learning rate on the optimizer."""
        self.lr = new_lr
        for param_group in self.optimizer.param_groups:
            param_group['lr'] = self.lr
        logger.info(f"Learning rate updated to: {self.lr}")

    def adjust_lr(self, factor: float):
        """Updates and clamps the learning rate in range [1e-5, 5e-4]."""
        new_lr = self.lr * factor
        self.lr = max(1e-5, min(new_lr, 5e-4))
        for param_group in self.optimizer.param_groups:
            param_group['lr'] = self.lr
        logger.info(f"Learning rate adjusted to: {self.lr}")

    def update_hyperparams(
        self,
        learning_rate: Optional[float] = None,
        ewc_lambda: Optional[float] = None,
        replay_ratio: Optional[float] = None
    ):
        """Updates hyperparameters dynamically."""
        if learning_rate is not None:
            self.lr = learning_rate
            for param_group in self.optimizer.param_groups:
                param_group['lr'] = self.lr
            logger.info(f"Hyperparam Reload: learning_rate = {self.lr}")
        if ewc_lambda is not None:
            self.ewc_lambda = ewc_lambda
            self.ewc.ewc_lambda = ewc_lambda
            logger.info(f"Hyperparam Reload: ewc_lambda = {self.ewc_lambda}")
        if replay_ratio is not None:
            self.replay_ratio = replay_ratio
            logger.info(f"Hyperparam Reload: replay_ratio = {self.replay_ratio}")

    async def update(self, demo: List[Dict[str, Any]]) -> LearningEvent:
        """Pushes demonstration to buffer and executes a regularized online gradient step."""
        # Dynamically check input and output dimensions of model
        input_dim = 63
        for m in self.model.modules():
            if isinstance(m, nn.Linear):
                input_dim = m.in_features
                break
        
        output_dim = 3
        for m in reversed(list(self.model.modules())):
            if isinstance(m, nn.Linear):
                output_dim = m.out_features
                break

        if not demo:
            return LearningEvent({
                "type": "update_complete",
                "step": self.update_step,
                "loss": 0.0,
                "val_accuracy": self.best_val_accuracy,
                "per_task_accuracy": {t: h for t, h in self.prev_accs.items()},
                "learning_rate": self.lr,
                "replay_ratio": self.replay_ratio,
                "timestamp_ms": int(time.time() * 1000)
            })

        # 1. Format and push demonstration entry
        session_id = str(uuid.uuid4())
        label = f"demo_session_{self.update_step + 1}.h5"
        entry = {
            "session_id": session_id,
            "label": label,
            "frames": demo,
            "added_at": int(time.time() * 1000),
            "times_sampled": 0
        }
        await self.replay_buffer.push(entry)

        val_accs = self._eval_val_dataset()
        val_acc = val_accs.get("overall", 0.0)

        # Handle pause state
        if self.paused:
            self.status = "paused"
            return LearningEvent({
                "type": "update_complete",
                "step": self.update_step,
                "loss": 0.0,
                "val_accuracy": val_acc,
                "per_task_accuracy": {t: h for t, h in val_accs.items() if t != "overall"},
                "learning_rate": self.lr,
                "replay_ratio": self.replay_ratio,
                "timestamp_ms": int(time.time() * 1000)
            })

        self.status = "updating"
        try:
            # 2. Extract mini-batch (80% from new demo, 20% from replay buffer)
            parsed_demo = []
            for f in demo:
                if f.get("mode") == "fatigue_excluded" or f.get("fatigue_score", 0.0) >= 0.4:
                    continue
                obs = f.get("obs")
                action = f.get("jointAngles") or f.get("action")
                if obs is not None and action is not None:
                    obs_padded = obs[:input_dim] + [0.0] * max(0, input_dim - len(obs))
                    action_padded = action[:output_dim] + [0.0] * max(0, output_dim - len(action))
                    parsed_demo.append((obs_padded, action_padded))

            if not parsed_demo:
                self.status = "idle"
                return LearningEvent({
                    "type": "update_complete",
                    "step": self.update_step,
                    "loss": 0.0,
                    "val_accuracy": val_acc,
                    "per_task_accuracy": {t: h for t, h in val_accs.items() if t != "overall"},
                    "learning_rate": self.lr,
                    "replay_ratio": self.replay_ratio,
                    "timestamp_ms": int(time.time() * 1000)
                })

            batch_size = 32
            num_replay = int(batch_size * self.replay_ratio)
            num_new = batch_size - num_replay

            batch_samples = []
            
            # Sample from new demo
            new_indices = np.random.choice(len(parsed_demo), size=min(num_new, len(parsed_demo)), replace=True)
            batch_samples.extend([parsed_demo[i] for i in new_indices])

            # Sample from replay buffer
            self.last_batch_highlighted_indices = []
            total_replay_needed = batch_size - len(batch_samples)
            if total_replay_needed > 0:
                replay_frames = await self.replay_buffer.sample(total_replay_needed)
                for rf in replay_frames:
                    obs = rf.get("obs") or [0.0] * input_dim
                    action = rf.get("jointAngles") or rf.get("action") or [0.0] * output_dim
                    obs_padded = obs[:input_dim] + [0.0] * max(0, input_dim - len(obs))
                    action_padded = action[:output_dim] + [0.0] * max(0, output_dim - len(action))
                    batch_samples.append((obs_padded, action_padded))

            # 3. Model Optimization Step
            self.model.train()
            for m in self.model.modules():
                if isinstance(m, (nn.BatchNorm1d, nn.BatchNorm2d)):
                    m.eval()
            obs_tensor = torch.tensor([s[0] for s in batch_samples], dtype=torch.float32).to(self.device)
            action_tensor = torch.tensor([s[1] for s in batch_samples], dtype=torch.float32).to(self.device)

            self.optimizer.zero_grad()
            pred = self.model(obs_tensor)
            
            mse_loss = self.criterion(pred, action_tensor)
            ewc_penalty = self.ewc.penalty(self.model)
            
            loss = mse_loss + ewc_penalty
            if torch.isnan(loss) or torch.isinf(loss):
                raise ValueError("Loss contains NaN or Inf")
            loss.backward()
            nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
            self.optimizer.step()

            self.update_step += 1

            # 4. Evaluate Validation Accuracy & Check forgetting alerts
            val_accs = self._eval_val_dataset()
            val_acc = val_accs.get("overall", 0.0)
            task_accs = {t: h for t, h in val_accs.items() if t != "overall"}

            # Build event payload
            event_data = {
                "type": "update_complete",
                "step": self.update_step,
                "loss": float(mse_loss.item()),
                "val_accuracy": val_acc,
                "per_task_accuracy": task_accs,
                "learning_rate": self.lr,
                "replay_ratio": self.replay_ratio,
                "timestamp_ms": int(time.time() * 1000)
            }

            # Broadcast update_complete
            from core.deployment.api_gateway.gateway import broadcast_learning_event
            await broadcast_learning_event(event_data)

            # Check forgetting alerts
            alert = self._check_forgetting(val_accs)
            if alert:
                # Broadcast forgetting_detected
                await broadcast_learning_event({
                    "type": "forgetting_detected",
                    "step": self.update_step,
                    "loss": float(mse_loss.item()),
                    "val_accuracy": val_acc,
                    "per_task_accuracy": task_accs,
                    "learning_rate": self.lr,
                    "replay_ratio": self.replay_ratio,
                    "timestamp_ms": int(time.time() * 1000),
                    "alert": alert
                })
                
                # Check for consistent degradation (3+ consecutive alerts on same task)
                task = alert["task_label"]
                self.consecutive_alerts[task] = self.consecutive_alerts.get(task, 0) + 1
                if self.consecutive_alerts[task] >= 3:
                    logger.warning(f"Consistent task degradation on '{task}'. Decaying learning rate.")
                    self.adjust_lr(0.5)
                    self.consecutive_alerts[task] = 0
                    
                    # Broadcast lr_adjusted event
                    await broadcast_learning_event({
                        "type": "lr_adjusted",
                        "step": self.update_step,
                        "loss": float(mse_loss.item()),
                        "val_accuracy": val_acc,
                        "per_task_accuracy": task_accs,
                        "learning_rate": self.lr,
                        "replay_ratio": self.replay_ratio,
                        "timestamp_ms": int(time.time() * 1000)
                    })
            else:
                # Reset task alert counters on no alert
                self.consecutive_alerts = {}

            # Save checkpoint if accuracy improves
            saved = self._maybe_checkpoint(val_acc)
            if saved:
                # Broadcast checkpoint_saved
                await broadcast_learning_event({
                    "type": "checkpoint_saved",
                    "step": self.update_step,
                    "loss": float(mse_loss.item()),
                    "val_accuracy": val_acc,
                    "per_task_accuracy": task_accs,
                    "learning_rate": self.lr,
                    "replay_ratio": self.replay_ratio,
                    "timestamp_ms": int(time.time() * 1000)
                })

            self.status = "idle"
            return LearningEvent(event_data)

        except Exception as e:
            self.status = "error"
            logger.error(f"Error executing online update: {e}")
            return LearningEvent({
                "type": "update_complete",
                "step": self.update_step,
                "loss": 0.0,
                "val_accuracy": val_acc,
                "per_task_accuracy": {t: h for t, h in self.prev_accs.items() if t != "overall"},
                "learning_rate": self.lr,
                "replay_ratio": self.replay_ratio,
                "timestamp_ms": int(time.time() * 1000),
                "error": str(e)
            })
            
    def save_replay_buffer(self):
        """Synchronously persists replay buffer to disk."""
        self.replay_buffer.save_to_disk()

    def load_replay_buffer(self):
        """Loads replay buffer from disk."""
        self.replay_buffer.load_from_disk()
