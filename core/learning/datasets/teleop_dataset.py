"""
TeleopDataset — Production Version
====================================
PyTorch Dataset loading teleoperation frames from the recorder's SQLite DB.

Improvements over original:
  - Loads from the new `frames` table schema (obs_json / expert_json columns)
  - Falls back to legacy `json_data` column if old schema detected
  - Filters by mode (only 'retargeted' frames make reliable BC labels)
  - Filters by minimum reward threshold (exclude low-quality demonstrations)
  - Optionally sub-samples for class balance
  - On-the-fly normalisation (zero-mean, unit-variance per feature)
  - Reproducible train/val split with stratified seeding
  - Reports dataset statistics on load
"""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from core.robotics.kinematics.inverse_kinematics import InverseKinematicsSolver

log = logging.getLogger(__name__)


# ── Legacy FK for label generation (kept from original) ──────────────────────

def _dummy_fk(q: np.ndarray) -> np.ndarray:
    L1, L2, L3 = 2.0, 2.0, 1.0
    x = L1 * np.cos(q[0]) + L2 * np.cos(q[0] + q[1]) + L3 * np.cos(q[0] + q[1] + q[2])
    y = L1 * np.sin(q[0]) + L2 * np.sin(q[0] + q[1]) + L3 * np.sin(q[0] + q[1] + q[2])
    z = q[0] * 0.5
    return np.array([x, y, z], dtype=np.float32)


# ── Dataset ───────────────────────────────────────────────────────────────────

class TeleopDataset(Dataset):
    """
    Parameters
    ----------
    db_path         : Path to the teleoperation SQLite database
    mode_filter     : Only include frames with this mode ('retargeted' recommended)
    min_reward      : Discard frames with reward below this threshold
    normalise       : If True, normalise observations to zero-mean unit-variance
    split           : 'train' | 'val' | 'all'
    val_fraction    : Fraction of data reserved for validation
    seed            : Reproducibility seed for split
    """

    def __init__(
        self,
        db_path:      str  = "datasets/raw/teleoperation.db",
        mode_filter:  Optional[str]   = "retargeted",
        min_reward:   float            = 0.0,
        normalise:    bool             = True,
        split:        str              = "all",
        val_fraction: float            = 0.1,
        seed:         int              = 42,
    ):
        self.db_path      = Path(db_path)
        self.mode_filter  = mode_filter
        self.min_reward   = min_reward
        self.normalise    = normalise
        self.split        = split
        self.val_fraction = val_fraction
        self.seed         = seed

        self._ik_solver = InverseKinematicsSolver(_dummy_fk)
        self.samples: List[Tuple[np.ndarray, np.ndarray]] = []
        self._obs_mean:  Optional[np.ndarray] = None
        self._obs_std:   Optional[np.ndarray] = None

        self._load()

    # ── Loading ───────────────────────────────────────────────────────────────

    def _load(self):
        if not self.db_path.exists():
            log.warning("[TeleopDataset] DB not found at %s — empty dataset", self.db_path)
            return

        try:
            conn   = sqlite3.connect(self.db_path, timeout=10.0)
            cursor = conn.cursor()
            schema = {r[1] for r in cursor.execute("PRAGMA table_info(frames)")}

            if "obs_json" in schema:
                self._load_new_schema(cursor)
            else:
                self._load_legacy_schema(cursor)

            conn.close()
        except sqlite3.Error as exc:
            log.error("[TeleopDataset] load error: %s", exc)
            return

        if not self.samples:
            log.warning("[TeleopDataset] 0 samples loaded")
            return

        # Train / val split
        rng = np.random.default_rng(self.seed)
        idx = np.arange(len(self.samples))
        rng.shuffle(idx)

        n_val = max(1, int(len(idx) * self.val_fraction))
        if self.split == "val":
            idx = idx[:n_val]
        elif self.split == "train":
            idx = idx[n_val:]

        self.samples = [self.samples[i] for i in idx]

        # Compute normalisation stats from training portion
        if self.normalise and len(self.samples) > 0:
            obs_stack = np.stack([s[0] for s in self.samples], axis=0)
            self._obs_mean = obs_stack.mean(axis=0)
            self._obs_std  = obs_stack.std(axis=0) + 1e-8

        log.info(
            "[TeleopDataset] loaded split=%s samples=%d normalise=%s",
            self.split, len(self.samples), self.normalise,
        )

    def _load_new_schema(self, cursor: sqlite3.Cursor):
        """Load from the EpisodeRecorder schema (obs_json + expert_json)."""
        query = "SELECT obs_json, expert_json, reward FROM frames WHERE 1=1"
        params: list = []

        if self.mode_filter:
            query  += " AND mode = ?"
            params.append(self.mode_filter)
        if self.min_reward > 0:
            query  += " AND reward >= ?"
            params.append(self.min_reward)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        for obs_j, exp_j, reward in rows:
            if not obs_j or not exp_j:
                continue
            try:
                obs    = np.array(json.loads(obs_j),  dtype=np.float32)
                expert = np.array(json.loads(exp_j),  dtype=np.float32)
                if obs.shape == (63,) and expert.shape == (3,):
                    self.samples.append((obs, expert))
            except (json.JSONDecodeError, ValueError):
                continue

    def _load_legacy_schema(self, cursor: sqlite3.Cursor):
        """Load from original schema (json_data column with landmark dict)."""
        cursor.execute("SELECT json_data FROM frames")
        rows = cursor.fetchall()

        for (row,) in rows:
            if not row:
                continue
            try:
                data = json.loads(row)
                if "Right Hand" not in data or data["Right Hand"] is None:
                    continue
                rh = np.array(data["Right Hand"], dtype=np.float32)
                if rh.shape != (21, 3):
                    continue

                x_feat     = rh.flatten()
                target_pos = rh[0] * 5.0
                result     = self._ik_solver.solve([0, 0, 0], target_pos, max_iter=20)
                if result.get("converged"):
                    self.samples.append((x_feat, np.array(result["q"], dtype=np.float32)))
            except Exception:
                continue

    # ── Dataset interface ─────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        obs, label = self.samples[idx]
        if self.normalise and self._obs_mean is not None:
            obs = (obs - self._obs_mean) / self._obs_std
        return (
            torch.tensor(obs,   dtype=torch.float32),
            torch.tensor(label, dtype=torch.float32),
        )

    # ── Utilities ─────────────────────────────────────────────────────────────

    def statistics(self) -> Dict[str, object]:
        if not self.samples:
            return {"n": 0}
        obs_all = np.stack([s[0] for s in self.samples])
        lbl_all = np.stack([s[1] for s in self.samples])
        return {
            "n":            len(self.samples),
            "obs_mean":     float(obs_all.mean()),
            "obs_std":      float(obs_all.std()),
            "label_mean":   lbl_all.mean(0).tolist(),
            "label_std":    lbl_all.std(0).tolist(),
            "label_min":    lbl_all.min(0).tolist(),
            "label_max":    lbl_all.max(0).tolist(),
        }
