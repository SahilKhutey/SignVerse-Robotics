"""
MotionRetargetingPipeline
=========================
Single-call façade that composes the full retargeting chain:

    Raw MediaPipe Landmarks
          │
          ▼
    LandmarkKalmanSmoother      ← removes per-frame jitter
          │
          ▼
    MediaPipeSkeletonMapper     ← extracts bone vectors & anatomical angles
          │
          ▼
    HumanToRobotMapper          ← maps human angles → robot joint angles
          │
          ▼
    JointConstraintAdapter      ← clamps to hardware limits, reports violations
          │
          ▼
    process() result dict

Typical usage
-------------
    pipeline = MotionRetargetingPipeline()
    result = pipeline.process(pose_landmarks)
    q = [result["joints"]["J0"], result["joints"]["J1"], result["joints"]["J2"]]
"""

import numpy as np
from typing import Dict, List, Optional, Any

from core.robotics.retargeting.kalman_smoother import LandmarkKalmanSmoother
from core.robotics.retargeting.skeleton_mapper import MediaPipeSkeletonMapper
from core.robotics.retargeting.human_to_robot import HumanToRobotMapper, DEFAULT_JOINT_MAP
from core.robotics.retargeting.constraint_adapter import (
    JointConstraintAdapter,
    DEFAULT_JOINT_LIMITS,
    ConstraintViolation,
)


class MotionRetargetingPipeline:
    """
    Composing façade for the full human → robot retargeting chain.

    Parameters
    ----------
    process_noise : float
        Kalman process noise.  Lower = smoother but more latency.
    measurement_noise : float
        Kalman measurement noise.  Higher = trust the filter more.
    joint_map : dict, optional
        Custom joint correspondence table for HumanToRobotMapper.
    joint_limits : dict, optional
        Custom per-joint (lower, upper) limits for JointConstraintAdapter.
    enable_smoothing : bool
        Set False to bypass the Kalman smoother (useful for frame-accurate
        debugging or when input is already pre-filtered).
    """

    def __init__(
        self,
        process_noise: float = 1e-2,
        measurement_noise: float = 1e-1,
        joint_map: Optional[Dict] = None,
        joint_limits: Optional[Dict] = None,
        enable_smoothing: bool = True,
    ):
        self._enable_smoothing = enable_smoothing

        self._smoother  = LandmarkKalmanSmoother(
            n_landmarks=33,
            process_noise=process_noise,
            measurement_noise=measurement_noise,
        )
        self._skeleton  = MediaPipeSkeletonMapper()
        self._mapper    = HumanToRobotMapper(joint_map=joint_map)
        self._adapter   = JointConstraintAdapter(limits=joint_limits)

    # ──────────────────────────────────────────────────────────────────────
    def process(self, pose_landmarks: Optional[np.ndarray]) -> Dict[str, Any]:
        """
        Run the complete retargeting chain on a single frame.

        Parameters
        ----------
        pose_landmarks : np.ndarray or None
            MediaPipe body-pose landmark array, shape (33, 3) or (33, 4).
            Pass None to produce a safe zero-target output.

        Returns
        -------
        dict with keys:
            "joints"      : dict[str, float]  — constrained robot joint angles (rad)
            "violations"  : list[dict]        — serialisable violation records
            "mode"        : str               — always "retargeted"
            "smoothed"    : bool              — whether Kalman was applied
            "valid"       : bool              — False if landmarks were absent
            "source_angles": dict[str, float] — human anatomical angles (debug)
        """
        valid = pose_landmarks is not None and (
            isinstance(pose_landmarks, np.ndarray) and pose_landmarks.shape[0] >= 33
        )

        # ── 1. Kalman smoothing ───────────────────────────────────────────
        if valid and self._enable_smoothing:
            smoothed = self._smoother.smooth(pose_landmarks)
            did_smooth = True
        else:
            smoothed = pose_landmarks
            did_smooth = False

        # ── 2. Skeleton / bone-vector extraction ──────────────────────────
        skeleton_result = self._skeleton.extract(smoothed) if valid else \
            MediaPipeSkeletonMapper._empty_result()

        # ── 3. Human → Robot angle mapping ───────────────────────────────
        joint_target = self._mapper.map(skeleton_result)

        # ── 4. Joint constraint enforcement ──────────────────────────────
        constrained, violations = self._adapter.apply_constraints(joint_target.joints)

        return {
            "joints":       constrained,
            "violations":   [self._serialise_violation(v) for v in violations],
            "mode":         "retargeted",
            "smoothed":     did_smooth,
            "valid":        valid and joint_target.valid,
            "source_angles": joint_target.source_angles,
        }

    # ──────────────────────────────────────────────────────────────────────
    def reset(self) -> None:
        """Reset the Kalman smoother state (call between unrelated sequences)."""
        self._smoother.reset()

    # ──────────────────────────────────────────────────────────────────────
    @staticmethod
    def _serialise_violation(v: ConstraintViolation) -> Dict[str, Any]:
        return {
            "joint":     v.joint,
            "requested": round(v.requested, 6),
            "clamped":   round(v.clamped, 6),
            "severity":  v.severity,
            "limit_hit": v.limit_hit,
        }
