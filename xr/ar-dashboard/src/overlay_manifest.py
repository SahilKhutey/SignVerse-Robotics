"""
SignVerse AR Dashboard Overlay Manifest
========================================
Defines the AR overlay components and their spatial anchoring rules.

XR Frameworks supported:
  - WebXR (Browser AR via React Three Fiber)
  - ARCore (Android)
  - ARKit (iOS)
  - OpenXR (Universal)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AnchorType(Enum):
    WORLD = "world"          # Fixed to world coordinates
    ROBOT = "robot"          # Anchored to a tracked robot
    SURFACE = "surface"      # Anchored to detected surface
    CAMERA = "camera"        # Fixed to camera view (HUD)
    HAND = "hand"            # Tracked to user's hand


class OverlayType(Enum):
    TELEMETRY_CARD = "telemetry_card"
    ROBOT_STATUS = "robot_status"
    NAVIGATION_PATH = "navigation_path"
    SENSOR_CONE = "sensor_cone"
    MISSION_MARKER = "mission_marker"
    AI_CONFIDENCE = "ai_confidence"
    SAFETY_ZONE = "safety_zone"
    EMERGENCY_INDICATOR = "emergency_indicator"


@dataclass
class SpatialAnchor:
    """Defines how an AR overlay is attached to the world."""
    anchor_type: AnchorType
    target_id: Optional[str] = None   # Robot ID, surface ID, etc.
    offset: dict = field(default_factory=lambda: {"x": 0.0, "y": 0.2, "z": 0.0})
    always_face_user: bool = True


@dataclass
class AROverlay:
    """
    A single AR overlay element.
    Each overlay has a spatial anchor, visibility rules, and data binding.
    """
    overlay_id: str
    overlay_type: OverlayType
    anchor: SpatialAnchor
    title: str
    data_source: str           # WebSocket channel or REST endpoint
    visible_roles: list[str]   # RBAC: which roles can see this overlay
    refresh_rate_hz: float = 10.0
    priority: int = 1          # Higher = shown first when space is limited


# ─── Default AR Dashboard Configuration ──────────────────────────────────────

DEFAULT_AR_OVERLAYS = [
    AROverlay(
        overlay_id="robot_telemetry_ar",
        overlay_type=OverlayType.TELEMETRY_CARD,
        anchor=SpatialAnchor(anchor_type=AnchorType.ROBOT, target_id="*"),
        title="Robot Telemetry",
        data_source="ws://gateway/ws/telemetry",
        visible_roles=["ROBOTICS_OPERATOR", "ADMIN"],
        refresh_rate_hz=30.0,
        priority=10,
    ),
    AROverlay(
        overlay_id="nav_path_ar",
        overlay_type=OverlayType.NAVIGATION_PATH,
        anchor=SpatialAnchor(anchor_type=AnchorType.WORLD),
        title="Navigation Path",
        data_source="ws://gateway/ws/navigation",
        visible_roles=["ROBOTICS_OPERATOR", "AI_ENGINEER", "ADMIN"],
        refresh_rate_hz=15.0,
        priority=8,
    ),
    AROverlay(
        overlay_id="ai_confidence_hud",
        overlay_type=OverlayType.AI_CONFIDENCE,
        anchor=SpatialAnchor(anchor_type=AnchorType.CAMERA, always_face_user=True),
        title="AI Confidence HUD",
        data_source="ws://gateway/ws/ai-inference",
        visible_roles=["AI_ENGINEER", "ADMIN"],
        refresh_rate_hz=5.0,
        priority=5,
    ),
    AROverlay(
        overlay_id="safety_zone_ar",
        overlay_type=OverlayType.SAFETY_ZONE,
        anchor=SpatialAnchor(anchor_type=AnchorType.WORLD),
        title="Safety Exclusion Zone",
        data_source="ws://gateway/ws/safety",
        visible_roles=["OBSERVER", "ROBOTICS_OPERATOR", "ADMIN"],
        refresh_rate_hz=1.0,
        priority=20,  # Always shown — safety critical
    ),
    AROverlay(
        overlay_id="estop_indicator",
        overlay_type=OverlayType.EMERGENCY_INDICATOR,
        anchor=SpatialAnchor(anchor_type=AnchorType.CAMERA, always_face_user=True,
                             offset={"x": 0.0, "y": 0.4, "z": 0.0}),
        title="EMERGENCY STOP ACTIVE",
        data_source="ws://gateway/ws/estop",
        visible_roles=["OBSERVER", "ROBOTICS_OPERATOR", "ADMIN"],
        refresh_rate_hz=60.0,
        priority=100,  # Maximum priority — always visible during E-Stop
    ),
]
