"""
HumanToRobotMapper
==================
Converts anatomical joint angles (output of MediaPipeSkeletonMapper) into
robot joint angles using a configurable correspondence table.

Design principles:
- Robot-agnostic by default; callers can supply a custom `joint_map`
- All robot angles are expressed in **radians**
- Preserves a structured `RobotJointTarget` dataclass for downstream consumers
- Falls back gracefully when skeleton data is incomplete or invalid

Default correspondence (3-DOF arm — shoulder_abduction, shoulder_roll, elbow_flexion):
  robot J0 ← right_shoulder_abduction   (mapped from [0, π] → joint limits)
  robot J1 ← right_shoulder_roll        (mapped from [-π/2, π/2] → joint limits)
  robot J2 ← right_elbow_flexion        (mapped from [0, π] → joint limits)
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class RobotJointTarget:
    """
    Structured output from the HumanToRobotMapper.

    Attributes
    ----------
    joints : dict[str, float]
        Mapping of joint-name → target angle in radians.
    mode : str
        Always "retargeted" for outputs from this mapper.
    source_angles : dict[str, float]
        The raw human anatomical angles that were mapped (for debugging).
    valid : bool
        False when the input skeleton was invalid/incomplete.
    """
    joints: Dict[str, float] = field(default_factory=dict)
    mode: str = "retargeted"
    source_angles: Dict[str, float] = field(default_factory=dict)
    valid: bool = True


# ── Default joint correspondence ─────────────────────────────────────────────
# Each entry: robot_joint_name → (human_angle_key, input_range, output_range)
# Ranges are (min, max) tuples; a linear remap is applied.
DEFAULT_JOINT_MAP: Dict[str, Dict] = {
    "J0": {
        "human_key":    "right_shoulder_abduction",
        "input_range":  (0.0,  np.pi),
        "output_range": (0.0,  np.pi / 2.0),   # 90° max arm raise
        "description":  "Right shoulder abduction",
    },
    "J1": {
        "human_key":    "right_shoulder_roll",
        "input_range":  (-np.pi / 2.0, np.pi / 2.0),
        "output_range": (-np.pi / 4.0, np.pi / 4.0),  # ±45° roll
        "description":  "Right shoulder roll",
    },
    "J2": {
        "human_key":    "right_elbow_flexion",
        "input_range":  (0.0,  np.pi),
        "output_range": (0.0,  np.pi * 5.0 / 6.0),   # 150° max elbow flex
        "description":  "Right elbow flexion",
    },
}


def _linear_remap(value: float, in_min: float, in_max: float,
                  out_min: float, out_max: float) -> float:
    """
    Linearly remaps `value` from [in_min, in_max] → [out_min, out_max].
    The output is clamped to [out_min, out_max] to respect hardware limits,
    but the input is NOT pre-clamped so that small inter-pose differences
    are preserved in the output rather than being collapsed to the boundary.
    """
    if abs(in_max - in_min) < 1e-9:
        return (out_min + out_max) / 2.0
    ratio = (float(value) - in_min) / (in_max - in_min)
    raw = out_min + ratio * (out_max - out_min)
    return float(np.clip(raw, min(out_min, out_max), max(out_min, out_max)))


class HumanToRobotMapper:
    """
    Maps human anatomical joint angles → robot joint target angles.

    Parameters
    ----------
    joint_map : dict, optional
        Custom correspondence table.  If None, uses DEFAULT_JOINT_MAP.
        Each entry must have keys: human_key, input_range, output_range.
    """

    def __init__(self, joint_map: Optional[Dict] = None):
        self.joint_map = joint_map if joint_map is not None else DEFAULT_JOINT_MAP

    # ──────────────────────────────────────────────────────────────────────
    def map(self, skeleton_result: Dict) -> RobotJointTarget:
        """
        Parameters
        ----------
        skeleton_result : dict
            Output of `MediaPipeSkeletonMapper.extract()`.  Must contain
            "joint_angles" (dict[str, float]) and "valid" (bool).

        Returns
        -------
        RobotJointTarget
            Mapped joint angles in radians with metadata.
        """
        if not skeleton_result.get("valid", False):
            # Return a zero-position safe target when skeleton is absent
            zero_joints = {jname: 0.0 for jname in self.joint_map}
            return RobotJointTarget(
                joints=zero_joints,
                valid=False,
                source_angles={},
            )

        human_angles: Dict[str, float] = skeleton_result.get("joint_angles", {})
        robot_joints: Dict[str, float] = {}

        for robot_joint, mapping in self.joint_map.items():
            human_key     = mapping["human_key"]
            in_min, in_max  = mapping["input_range"]
            out_min, out_max = mapping["output_range"]

            raw_angle = human_angles.get(human_key, 0.0)
            robot_angle = _linear_remap(raw_angle, in_min, in_max, out_min, out_max)
            robot_joints[robot_joint] = float(robot_angle)

        return RobotJointTarget(
            joints=robot_joints,
            mode="retargeted",
            source_angles=human_angles,
            valid=True,
        )

    # ──────────────────────────────────────────────────────────────────────
    def map_batch(self, skeleton_results: List[Dict]) -> List[RobotJointTarget]:
        """Convenience wrapper to process a sequence of frames."""
        return [self.map(sr) for sr in skeleton_results]
