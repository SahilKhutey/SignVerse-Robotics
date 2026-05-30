"""
SignVerse Multi-Objective RL Reward Engine — Phase 11
=====================================================
Computes reward signals for Reinforcement Learning agents controlling
robot joints in simulation and sim-to-real transfer.

Objectives (weighted sum):
  1. Pose Accuracy      — L2 distance to target joint angles, per-joint weighted
  2. Smoothness         — Jerk penalty (3rd derivative approximated as Δacceleration)
  3. Safety Margin      — Bonus for staying far from joint limits and collision zones
  4. Energy Efficiency  — Penalises high effort (sum of squared joint velocities)
  5. Gesture Fidelity   — Cosine similarity in 33-dim pose embedding space

All objectives are normalised to [-1, 1] before weighting, ensuring the
final reward is interpretable and stable across different robot configurations.

Usage:
    from backend.rl.reward_systems import RewardEngine, RewardConfig

    engine = RewardEngine(RewardConfig(pose_weight=0.4, smoothness_weight=0.2))
    reward = engine.compute(
        current_pose={"J0": 0.1, "J1": -0.3, "J2": 0.5},
        target_pose={"J0": 0.0, "J1": -0.4, "J2": 0.6},
        prev_pose={"J0": 0.15, "J1": -0.2, "J2": 0.4},
        prev_prev_pose={"J0": 0.20, "J1": -0.1, "J2": 0.3},
    )
    print(reward.total, reward.breakdown)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# Joint Metadata
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class JointSpec:
    """Physical constraints for a single robot joint."""
    name: str
    min_angle: float      # radians
    max_angle: float      # radians
    max_velocity: float   # rad/s
    max_torque: float     # N·m
    importance: float = 1.0  # Reward weighting for this joint


# Default 7-DOF humanoid arm joint specifications
DEFAULT_JOINT_SPECS: Dict[str, JointSpec] = {
    "shoulder_yaw":   JointSpec("shoulder_yaw",  -math.pi, math.pi,     3.0, 40.0, 1.0),
    "shoulder_pitch": JointSpec("shoulder_pitch", -math.pi/2, math.pi,  3.0, 40.0, 1.0),
    "shoulder_roll":  JointSpec("shoulder_roll",  -math.pi, math.pi,    3.0, 30.0, 0.8),
    "elbow_flex":     JointSpec("elbow_flex",      0.0, math.pi * 0.95, 4.0, 25.0, 0.9),
    "forearm_roll":   JointSpec("forearm_roll",   -math.pi, math.pi,    4.0, 15.0, 0.7),
    "wrist_flex":     JointSpec("wrist_flex",     -math.pi/2, math.pi/2, 5.0, 10.0, 0.6),
    "wrist_roll":     JointSpec("wrist_roll",     -math.pi, math.pi,    5.0, 10.0, 0.6),
    # Generic fallback for arbitrary joint names
    "J0": JointSpec("J0", -math.pi, math.pi, 2.0, 20.0, 1.0),
    "J1": JointSpec("J1", -math.pi, math.pi, 2.0, 20.0, 1.0),
    "J2": JointSpec("J2", -math.pi, math.pi, 2.0, 20.0, 1.0),
}


# ─────────────────────────────────────────────────────────────────────────────
# Reward Configuration
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RewardConfig:
    """
    Per-objective weight configuration for the multi-objective reward engine.
    Weights should sum to approximately 1.0 for interpretable total rewards.
    """
    pose_weight:        float = 0.40   # Accuracy to target joint angles
    smoothness_weight:  float = 0.20   # Jerk / jerkiness penalty
    safety_weight:      float = 0.20   # Joint limit and collision clearance
    energy_weight:      float = 0.10   # Effort / energy efficiency
    fidelity_weight:    float = 0.10   # Gesture embedding cosine similarity

    # Hyperparameters
    pose_scale:         float = 2.0    # σ parameter for Gaussian pose reward shaping
    jerk_penalty_cap:   float = 1.0    # Maximum jerk penalty (prevents explosion)
    safety_margin_deg:  float = 5.0    # Degrees from joint limit considered "safe"
    energy_cap:         float = 1.0    # Maximum energy penalty (normalisation cap)
    clip_total:         bool  = True   # Whether to clip total reward to [-1, 1]

    def validate(self) -> None:
        """Raise ValueError if config values are out of range."""
        total = (
            self.pose_weight + self.smoothness_weight +
            self.safety_weight + self.energy_weight + self.fidelity_weight
        )
        if not (0.8 <= total <= 1.2):
            raise ValueError(
                f"Reward weights should sum to ~1.0, got {total:.3f}"
            )


# ─────────────────────────────────────────────────────────────────────────────
# Reward Breakdown
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RewardBreakdown:
    """Detailed per-objective reward components for debugging and logging."""
    pose_reward:       float
    smoothness_reward: float
    safety_reward:     float
    energy_reward:     float
    fidelity_reward:   float
    total:             float
    info:              Dict = field(default_factory=dict)

    def __str__(self) -> str:
        return (
            f"Reward(total={self.total:+.4f} | "
            f"pose={self.pose_reward:+.3f} "
            f"smooth={self.smoothness_reward:+.3f} "
            f"safety={self.safety_reward:+.3f} "
            f"energy={self.energy_reward:+.3f} "
            f"fidelity={self.fidelity_reward:+.3f})"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Vector Operations (no numpy dependency for edge deployment)
# ─────────────────────────────────────────────────────────────────────────────

def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(v: List[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity in [-1, 1]. Returns 0 if either vector is zero."""
    na, nb = _norm(a), _norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return max(-1.0, min(1.0, _dot(a, b) / (na * nb)))


def _pose_to_vector(pose: Dict[str, float]) -> List[float]:
    """Convert a joint angle dict to a sorted list for vector ops."""
    return [v for _, v in sorted(pose.items())]


# ─────────────────────────────────────────────────────────────────────────────
# Reward Engine
# ─────────────────────────────────────────────────────────────────────────────

class RewardEngine:
    """
    Multi-objective reward engine for SignVerse RL policy training.

    Computes a scalar reward from a weighted sum of 5 normalised objectives:

    1. **Pose accuracy**: Gaussian shaping on joint-angle L2 error.
       R_pose = exp(-‖Δθ‖² / (2σ²))  in [0, 1]

    2. **Smoothness**: Penalises jerk (Δ²θ between consecutive steps).
       R_smooth = 1 - min(‖jerk‖ / cap, 1)  in [0, 1]

    3. **Safety margin**: Bonus for staying far from joint limits.
       R_safety = mean(clearance_i / half_range_i)  in [0, 1]

    4. **Energy efficiency**: Penalises high squared velocities.
       R_energy = 1 - min(‖Δθ‖² / cap, 1)  in [0, 1]

    5. **Gesture fidelity**: Cosine similarity in joint-space embedding.
       R_fidelity = (cosine_similarity + 1) / 2  in [0, 1]

    Final:
       R_total = Σ w_i · R_i  (optionally clipped to [-1, 1])
    """

    def __init__(
        self,
        config: Optional[RewardConfig] = None,
        joint_specs: Optional[Dict[str, JointSpec]] = None,
    ):
        self.config = config or RewardConfig()
        self.joint_specs = joint_specs or DEFAULT_JOINT_SPECS
        self._episode_rewards: List[float] = []

    # ── Public API ────────────────────────────────────────────────────────────

    def compute(
        self,
        current_pose:   Dict[str, float],
        target_pose:    Dict[str, float],
        prev_pose:      Optional[Dict[str, float]] = None,
        prev_prev_pose: Optional[Dict[str, float]] = None,
        reference_embedding: Optional[List[float]] = None,
    ) -> RewardBreakdown:
        """
        Compute the multi-objective reward for a single RL step.

        Args:
            current_pose:        Current joint angles (rad), keyed by joint name.
            target_pose:         Target/reference joint angles (rad).
            prev_pose:           Previous step's joint angles (for velocity proxy).
            prev_prev_pose:      Step before previous (for jerk proxy).
            reference_embedding: Optional pre-computed embedding of the
                                 reference gesture for fidelity scoring.

        Returns:
            RewardBreakdown with per-objective scores and weighted total.
        """
        cfg = self.config

        # ── Objective 1: Pose Accuracy ────────────────────────────────────────
        pose_r = self._pose_reward(current_pose, target_pose)

        # ── Objective 2: Smoothness (Jerk Penalty) ────────────────────────────
        smooth_r = self._smoothness_reward(current_pose, prev_pose, prev_prev_pose)

        # ── Objective 3: Safety Margin ────────────────────────────────────────
        safety_r = self._safety_reward(current_pose)

        # ── Objective 4: Energy Efficiency ───────────────────────────────────
        energy_r = self._energy_reward(current_pose, prev_pose)

        # ── Objective 5: Gesture Fidelity ─────────────────────────────────────
        fidelity_r = self._fidelity_reward(current_pose, target_pose, reference_embedding)

        # ── Weighted Sum ──────────────────────────────────────────────────────
        total = (
            cfg.pose_weight        * pose_r     +
            cfg.smoothness_weight  * smooth_r   +
            cfg.safety_weight      * safety_r   +
            cfg.energy_weight      * energy_r   +
            cfg.fidelity_weight    * fidelity_r
        )

        if cfg.clip_total:
            total = max(-1.0, min(1.0, total))

        self._episode_rewards.append(total)

        return RewardBreakdown(
            pose_reward=pose_r,
            smoothness_reward=smooth_r,
            safety_reward=safety_r,
            energy_reward=energy_r,
            fidelity_reward=fidelity_r,
            total=total,
            info={
                "joint_count": len(current_pose),
                "config": {
                    "pose_w": cfg.pose_weight,
                    "smooth_w": cfg.smoothness_weight,
                    "safety_w": cfg.safety_weight,
                    "energy_w": cfg.energy_weight,
                    "fidelity_w": cfg.fidelity_weight,
                }
            },
        )

    def compute_motion_reward(
        self,
        current_pose: Dict[str, float],
        target_pose:  Dict[str, float],
    ) -> float:
        """
        Backward-compatible single-value reward.
        Returns the total weighted reward as a scalar.
        """
        breakdown = self.compute(current_pose, target_pose)
        return breakdown.total

    # ── Objectives ────────────────────────────────────────────────────────────

    def _pose_reward(
        self,
        current: Dict[str, float],
        target:  Dict[str, float],
    ) -> float:
        """
        Gaussian-shaped pose accuracy reward.
        Perfect match → 1.0; large error → near 0.0.
        """
        joints = set(current) & set(target)
        if not joints:
            return 0.0

        weighted_sq_error = 0.0
        total_weight = 0.0

        for joint in joints:
            spec = self.joint_specs.get(joint, JointSpec(joint, -math.pi, math.pi, 2.0, 20.0, 1.0))
            error = current[joint] - target[joint]
            weight = spec.importance
            weighted_sq_error += weight * (error ** 2)
            total_weight += weight

        if total_weight == 0.0:
            return 0.0

        mean_sq_error = weighted_sq_error / total_weight
        sigma_sq = self.config.pose_scale ** 2
        return math.exp(-mean_sq_error / (2.0 * sigma_sq))

    def _smoothness_reward(
        self,
        current:        Dict[str, float],
        prev:           Optional[Dict[str, float]],
        prev_prev:      Optional[Dict[str, float]],
    ) -> float:
        """
        Jerk-based smoothness reward.
        Jerk ≈ Δ(velocity) = (current - prev) - (prev - prev_prev)
        """
        if prev is None:
            return 1.0   # No prior data — no penalty

        joints = set(current) & set(prev)
        if not joints:
            return 1.0

        velocity = {j: current[j] - prev[j] for j in joints}

        if prev_prev is None:
            # Only velocity available — penalise high velocity as proxy
            sq_vel = sum(v ** 2 for v in velocity.values()) / max(1, len(velocity))
            jerk_mag = math.sqrt(sq_vel)
        else:
            prev_joints = set(prev) & set(prev_prev)
            jerk_vals = []
            for j in joints & prev_joints:
                prev_vel = prev[j] - prev_prev[j]
                jerk_vals.append(velocity[j] - prev_vel)
            if not jerk_vals:
                return 1.0
            jerk_mag = math.sqrt(sum(v ** 2 for v in jerk_vals) / len(jerk_vals))

        capped = min(jerk_mag, self.config.jerk_penalty_cap)
        return 1.0 - (capped / self.config.jerk_penalty_cap)

    def _safety_reward(self, current: Dict[str, float]) -> float:
        """
        Joint limit clearance reward.
        Returns the mean fractional clearance from limits across all joints.
        A joint at its limit gives 0; a joint at midrange gives 1.
        """
        margin_rad = math.radians(self.config.safety_margin_deg)
        clearances = []

        for joint, angle in current.items():
            spec = self.joint_specs.get(joint)
            if spec is None:
                continue

            half_range = (spec.max_angle - spec.min_angle) / 2.0
            if half_range <= 0:
                continue

            # Distance to nearest limit
            dist_to_min = angle - spec.min_angle
            dist_to_max = spec.max_angle - angle
            clearance = min(dist_to_min, dist_to_max)

            # Normalise to [0, 1]: 0 = at limit, 1 = at midrange
            norm_clearance = max(0.0, clearance / half_range)

            # Extra penalty if within safety margin
            if clearance < margin_rad:
                norm_clearance *= (clearance / margin_rad)

            clearances.append(norm_clearance)

        return sum(clearances) / max(1, len(clearances))

    def _energy_reward(
        self,
        current: Dict[str, float],
        prev:    Optional[Dict[str, float]],
    ) -> float:
        """
        Energy efficiency reward.
        Penalises high squared joint velocities (effort proxy).
        """
        if prev is None:
            return 1.0   # No velocity data

        joints = set(current) & set(prev)
        if not joints:
            return 1.0

        sq_effort = sum((current[j] - prev[j]) ** 2 for j in joints) / len(joints)
        capped = min(sq_effort, self.config.energy_cap)
        return 1.0 - (capped / self.config.energy_cap)

    def _fidelity_reward(
        self,
        current:             Dict[str, float],
        target:              Dict[str, float],
        reference_embedding: Optional[List[float]],
    ) -> float:
        """
        Gesture fidelity reward via cosine similarity.

        If a pre-computed reference embedding is provided, computes cosine
        similarity between the current pose vector and the reference.
        Otherwise falls back to direct cosine similarity between current
        and target joint angle vectors.
        """
        current_vec = _pose_to_vector(current)

        if reference_embedding is not None:
            # Cosine similarity to provided reference embedding
            if len(current_vec) != len(reference_embedding):
                # Pad/truncate to match
                n = min(len(current_vec), len(reference_embedding))
                current_vec = current_vec[:n]
                ref = reference_embedding[:n]
            else:
                ref = reference_embedding
            sim = _cosine_similarity(current_vec, ref)
        else:
            # Fall back: cosine similarity between current and target vectors
            target_vec = _pose_to_vector(target)
            joints = set(current) & set(target)
            if not joints:
                return 0.5  # Neutral
            c = [current[j] for j in sorted(joints)]
            t = [target[j] for j in sorted(joints)]
            sim = _cosine_similarity(c, t)

        # Map from [-1, 1] → [0, 1]
        return (sim + 1.0) / 2.0

    # ── Episode Statistics ────────────────────────────────────────────────────

    def episode_return(self) -> float:
        """Sum of all rewards in the current episode."""
        return sum(self._episode_rewards)

    def episode_mean_reward(self) -> float:
        """Mean reward per step in the current episode."""
        if not self._episode_rewards:
            return 0.0
        return self.episode_return() / len(self._episode_rewards)

    def reset_episode(self) -> None:
        """Reset episode reward accumulator (call at episode start)."""
        self._episode_rewards.clear()

    def joint_error_analysis(
        self,
        current: Dict[str, float],
        target:  Dict[str, float],
    ) -> Dict[str, float]:
        """
        Return a per-joint error map for diagnostic logging.

        Returns:
            Dict mapping joint name to absolute error in radians.
        """
        return {
            j: abs(current.get(j, 0.0) - target.get(j, 0.0))
            for j in set(current) | set(target)
        }


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton
# ─────────────────────────────────────────────────────────────────────────────

rl_reward_engine = RewardEngine(
    config=RewardConfig(
        pose_weight=0.40,
        smoothness_weight=0.20,
        safety_weight=0.20,
        energy_weight=0.10,
        fidelity_weight=0.10,
    )
)
