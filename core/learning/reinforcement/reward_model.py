"""
Shaped Reward Model
====================
Computes a multi-term shaped reward signal for BC/RL training.

Terms:
  1. Goal proximity   — exponential falloff from target position
  2. Joint smoothness — penalises large Δq between consecutive steps
  3. Constraint bonus — reward for staying within hard limits
  4. Velocity penalty — penalise runaway joint velocity
  5. Sign accuracy    — optional: reward if predicted sign matches label

All terms are individually configurable via weights. The total reward is
clipped to [-1, 1] so it stays well-scaled for policy gradient methods.
"""

from __future__ import annotations

import math
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, Optional, Sequence


@dataclass
class RewardWeights:
    goal_proximity:    float = 1.0
    joint_smoothness:  float = 0.3
    constraint_bonus:  float = 0.2
    velocity_penalty:  float = 0.1
    sign_accuracy:     float = 0.5


@dataclass
class RewardBreakdown:
    total:            float
    goal_proximity:   float
    joint_smoothness: float
    constraint_bonus: float
    velocity_penalty: float
    sign_accuracy:    float
    details:          Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, float]:
        return {
            "total":            self.total,
            "goal_proximity":   self.goal_proximity,
            "joint_smoothness": self.joint_smoothness,
            "constraint_bonus": self.constraint_bonus,
            "velocity_penalty": self.velocity_penalty,
            "sign_accuracy":    self.sign_accuracy,
            **self.details,
        }


# Default hardware joint limits (radians) — must match constraint_adapter.py
_DEFAULT_LIMITS: Dict[str, tuple[float, float]] = {
    "J0": (0.0,             math.pi / 2),          # 0–90°
    "J1": (-math.pi / 4,   math.pi / 4),           # ±45°
    "J2": (0.0,             math.pi * 5 / 6),      # 0–150°
}


class RewardModel:
    """
    Shaped multi-term reward function.

    Usage
    -----
    rm = RewardModel()
    r  = rm.compute(state, action, target, prev_action)
    """

    def __init__(
        self,
        weights: Optional[RewardWeights] = None,
        joint_limits: Optional[Dict[str, tuple[float, float]]] = None,
        goal_scale: float = 2.0,
    ):
        self.weights      = weights or RewardWeights()
        self.joint_limits = joint_limits or _DEFAULT_LIMITS
        self.goal_scale   = goal_scale   # steepness of proximity falloff

    # ── Public API ────────────────────────────────────────────────────────────

    def compute(
        self,
        state:         np.ndarray,           # observation (63-dim hand landmarks)
        action:        np.ndarray,           # predicted joint angles [J0, J1, J2]
        target:        Optional[np.ndarray] = None,  # expert joint angles (BC label)
        prev_action:   Optional[np.ndarray] = None,  # previous step action
        sign_label:    Optional[int]         = None,  # sign class id
        sign_pred:     Optional[int]         = None,
    ) -> RewardBreakdown:
        w = self.weights

        # 1. Goal proximity (MSE-based, inverted exponential)
        gp = self._goal_proximity(action, target)

        # 2. Joint smoothness
        js = self._joint_smoothness(action, prev_action)

        # 3. Constraint bonus
        cb = self._constraint_bonus(action)

        # 4. Velocity penalty (reuse smoothness signal)
        vp = self._velocity_penalty(action, prev_action)

        # 5. Sign accuracy
        sa = self._sign_accuracy(sign_label, sign_pred)

        raw = (
            w.goal_proximity   * gp
            + w.joint_smoothness * js
            + w.constraint_bonus * cb
            - w.velocity_penalty * vp
            + w.sign_accuracy    * sa
        )
        total = float(np.clip(raw, -1.0, 1.0))

        return RewardBreakdown(
            total=total,
            goal_proximity=gp,
            joint_smoothness=js,
            constraint_bonus=cb,
            velocity_penalty=vp,
            sign_accuracy=sa,
        )

    # ── Reward terms ──────────────────────────────────────────────────────────

    def _goal_proximity(
        self,
        action: np.ndarray,
        target: Optional[np.ndarray],
    ) -> float:
        if target is None:
            return 0.0
        action = np.asarray(action, dtype=float)
        target = np.asarray(target, dtype=float)
        mse    = float(np.mean((action - target) ** 2))
        # Exponential proximity: r = exp(-scale * mse), in [0, 1]
        return float(math.exp(-self.goal_scale * mse))

    def _joint_smoothness(
        self,
        action:      np.ndarray,
        prev_action: Optional[np.ndarray],
    ) -> float:
        """Reward for small angular change (high smoothness)."""
        if prev_action is None:
            return 1.0   # first step — no penalty
        delta = np.asarray(action, dtype=float) - np.asarray(prev_action, dtype=float)
        delta_norm = float(np.sqrt(np.sum(delta ** 2)))
        # r = 1 when Δ=0, decays to 0 around Δ=π
        return float(max(0.0, 1.0 - delta_norm / math.pi))

    def _constraint_bonus(self, action: np.ndarray) -> float:
        """Bonus (+1) if all joints within their hard limits, else 0."""
        action = np.asarray(action, dtype=float)
        joint_names = list(self.joint_limits.keys())
        for i, jname in enumerate(joint_names):
            if i >= len(action):
                break
            lo, hi = self.joint_limits[jname]
            if action[i] < lo or action[i] > hi:
                return 0.0
        return 1.0

    def _velocity_penalty(
        self,
        action:      np.ndarray,
        prev_action: Optional[np.ndarray],
    ) -> float:
        """Penalty proportional to joint velocity (Δq / 1 step)."""
        if prev_action is None:
            return 0.0
        delta = np.asarray(action, dtype=float) - np.asarray(prev_action, dtype=float)
        return float(np.sqrt(np.sum(delta ** 2)))

    def _sign_accuracy(
        self,
        label: Optional[int],
        pred:  Optional[int],
    ) -> float:
        if label is None or pred is None:
            return 0.0
        return 1.0 if label == pred else -0.5
