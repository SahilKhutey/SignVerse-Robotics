"""
JointConstraintAdapter
======================
Enforces per-joint hardware limits on a robot joint-angle dictionary and
produces violation flags for observability / safety logging.

Design:
- Each joint has (lower_limit, upper_limit) in radians
- Values outside limits are clamped (not rejected)
- Violations are recorded with severity: "soft" (within 10% of limit) or "hard"
- All limits are expressed in radians to match URDF convention

Default joint limits correspond to a generic 3-DOF servo arm:
  J0 — shoulder abduction  : [0°,  90°]   → [0, π/2]
  J1 — shoulder roll       : [-45°, 45°]  → [-π/4, π/4]
  J2 — elbow flexion       : [0°, 150°]   → [0, 5π/6]

Custom robots can supply their own limits via the constructor.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional


@dataclass
class ConstraintViolation:
    """Describes a single joint-limit violation event."""
    joint:     str
    requested: float    # radians — what the retargeter asked for
    clamped:   float    # radians — what was actually applied
    severity:  str      # "soft" | "hard"
    limit_hit: str      # "lower" | "upper"


# ── Default per-joint limits (radians) ───────────────────────────────────────
DEFAULT_JOINT_LIMITS: Dict[str, Tuple[float, float]] = {
    "J0": (0.0,          np.pi / 2.0),          # shoulder abduction 0–90°
    "J1": (-np.pi / 4.0, np.pi / 4.0),          # shoulder roll ±45°
    "J2": (0.0,          np.pi * 5.0 / 6.0),    # elbow flexion 0–150°
}

# Joints within this fraction of their range from a hard limit → "soft" violation
_SOFT_THRESHOLD = 0.10   # 10 % of range


class JointConstraintAdapter:
    """
    Applies hardware joint limits and produces violation reports.

    Parameters
    ----------
    limits : dict, optional
        Custom per-joint limits ``{joint_name: (lower_rad, upper_rad)}``.
        Merges with (and overrides) DEFAULT_JOINT_LIMITS for listed joints.
    """

    def __init__(self, limits: Optional[Dict[str, Tuple[float, float]]] = None):
        self.limits: Dict[str, Tuple[float, float]] = dict(DEFAULT_JOINT_LIMITS)
        if limits:
            self.limits.update(limits)

    # ──────────────────────────────────────────────────────────────────────
    def apply_constraints(
        self, joints: Dict[str, float]
    ) -> Tuple[Dict[str, float], List[ConstraintViolation]]:
        """
        Clamp joint angles to hardware limits.

        Parameters
        ----------
        joints : dict[str, float]
            Requested joint angles in radians.

        Returns
        -------
        constrained : dict[str, float]
            Clamped joint angles.
        violations : list[ConstraintViolation]
            Any limit events that occurred (empty if all within bounds).
        """
        constrained: Dict[str, float] = {}
        violations: List[ConstraintViolation] = []

        for joint, requested in joints.items():
            lower, upper = self.limits.get(joint, (-np.pi, np.pi))
            range_span = upper - lower

            clamped = float(np.clip(requested, lower, upper))
            constrained[joint] = clamped

            # ── Check for violation ───────────────────────────────────────
            if clamped != requested:
                # Hard violation — value was outside limits
                limit_hit = "lower" if requested < lower else "upper"
                violations.append(ConstraintViolation(
                    joint=joint,
                    requested=requested,
                    clamped=clamped,
                    severity="hard",
                    limit_hit=limit_hit,
                ))
            else:
                # Soft violation — close to a limit boundary
                soft_band = _SOFT_THRESHOLD * range_span
                if clamped < lower + soft_band:
                    violations.append(ConstraintViolation(
                        joint=joint,
                        requested=requested,
                        clamped=clamped,
                        severity="soft",
                        limit_hit="lower",
                    ))
                elif clamped > upper - soft_band:
                    violations.append(ConstraintViolation(
                        joint=joint,
                        requested=requested,
                        clamped=clamped,
                        severity="soft",
                        limit_hit="upper",
                    ))

        return constrained, violations

    # ──────────────────────────────────────────────────────────────────────
    def is_within_limits(self, joints: Dict[str, float]) -> bool:
        """Returns True only if ALL joints are within hard limits."""
        for joint, angle in joints.items():
            lower, upper = self.limits.get(joint, (-np.pi, np.pi))
            if not (lower <= angle <= upper):
                return False
        return True

    def get_limits(self) -> Dict[str, Tuple[float, float]]:
        """Return the active limits table."""
        return dict(self.limits)
