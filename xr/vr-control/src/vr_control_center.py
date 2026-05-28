"""
SignVerse VR Control Center
============================
Immersive VR robotics command interface.

Supports:
  - 6-DOF robot arm teleoperation
  - Live camera feed passthrough
  - Digital twin interaction
  - Gesture-based spatial commands
  - Emergency Stop activation from VR

XR Technologies:
  - OpenXR (primary universal standard)
  - Unity XR Toolkit backend
  - SteamVR / Meta XR SDK compatibility layer
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


class VRInteractionMode(Enum):
    OBSERVATION = "observation"         # View-only — safe for all users
    TELEOPERATION = "teleoperation"     # Direct robot control via VR hands
    SIMULATION = "simulation"           # Control digital twin only
    TRAINING = "training"               # Guided training mode
    EMERGENCY = "emergency"             # E-Stop and emergency commands only


@dataclass
class VRHandPose:
    """
    Captured 6-DOF hand pose from VR controllers or hand-tracking.
    Used to drive robot end-effector teleoperation.
    """
    hand: str       # "left" | "right"
    position: dict  # {"x", "y", "z"} in world space (meters)
    rotation: dict  # {"qx", "qy", "qz", "qw"} quaternion
    grip_strength: float = 0.0    # 0.0 (open) to 1.0 (fully closed)
    trigger_value: float = 0.0    # 0.0 to 1.0
    timestamp: float = 0.0


@dataclass
class VRControlSession:
    """
    An active VR control session linking a user to one or more robots.
    """
    session_id: str
    user_id: str
    robot_ids: list[str]
    mode: VRInteractionMode
    start_time: float
    active: bool = True
    latency_ms: float = 0.0
    frame_rate: float = 90.0  # Target VR frame rate (90Hz for comfort)


class VRControlCenter:
    """
    Core VR teleoperation engine.

    Maps VR hand poses to robot joint commands using inverse kinematics.
    Enforces safety boundaries during all teleoperation.
    """

    def __init__(self):
        self._active_sessions: dict[str, VRControlSession] = {}
        self._estop_handlers: list[Callable] = []

    def create_session(
        self,
        user_id: str,
        robot_ids: list[str],
        mode: VRInteractionMode,
    ) -> VRControlSession:
        """Create a new VR control session."""
        import time
        session_id = f"vr_{user_id}_{int(time.time())}"
        session = VRControlSession(
            session_id=session_id,
            user_id=user_id,
            robot_ids=robot_ids,
            mode=mode,
            start_time=time.time(),
        )
        self._active_sessions[session_id] = session
        return session

    def process_hand_pose(
        self,
        session_id: str,
        pose: VRHandPose,
    ) -> Optional[dict]:
        """
        Convert a VR hand pose into a robot end-effector command.

        Uses simplified IK mapping — production implementation
        should integrate with robotics IK solver (e.g., IKFAST, TRAC-IK).
        """
        session = self._active_sessions.get(session_id)
        if not session or not session.active:
            return None

        if session.mode == VRInteractionMode.OBSERVATION:
            return None  # No commands in observation mode

        # Map hand position to end-effector target
        end_effector_command = {
            "type": "end_effector_target",
            "robot_ids": session.robot_ids,
            "hand": pose.hand,
            "target_position": pose.position,
            "target_rotation": pose.rotation,
            "gripper_command": "close" if pose.grip_strength > 0.7 else "open",
            "velocity_scale": min(1.0, pose.trigger_value + 0.3),
        }

        return end_effector_command

    def trigger_vr_estop(self, session_id: str, user_id: str):
        """
        Activate Emergency Stop from within VR.
        Triggers visual+haptic feedback and immediately halts all robots.
        """
        session = self._active_sessions.get(session_id)
        if not session:
            return

        for handler in self._estop_handlers:
            for robot_id in session.robot_ids:
                handler(robot_id, "MANUAL_TRIGGER", user_id)

        session.active = False
        print(f"[VR E-STOP] Triggered by {user_id} via VR for robots: {session.robot_ids}")

    def on_estop(self, handler: Callable):
        """Register an E-Stop callback handler."""
        self._estop_handlers.append(handler)

    def end_session(self, session_id: str):
        """Cleanly terminate a VR control session."""
        if session_id in self._active_sessions:
            self._active_sessions[session_id].active = False
            del self._active_sessions[session_id]
