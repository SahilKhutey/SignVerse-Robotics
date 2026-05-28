"""
SignVerse World State Engine
============================
Persistent environment memory and spatial reasoning system.

Maintains a live, queryable model of the world including:
- Object positions and states
- Robot interactions with the environment
- Spatial history and scene changes
- Semantic object classification
"""

import time
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class ObjectClass(Enum):
    STATIC = "static"       # Walls, furniture — rarely change
    DYNAMIC = "dynamic"     # People, moving objects
    ROBOT = "robot"         # Robots in the environment
    SEMANTIC = "semantic"   # Labeled zones (safe area, restricted, etc.)


@dataclass
class WorldObject:
    """A tracked object in the persistent world model."""
    object_id: str
    label: str
    object_class: ObjectClass
    position: dict  # {"x": float, "y": float, "z": float}
    orientation: dict = field(default_factory=lambda: {"roll": 0.0, "pitch": 0.0, "yaw": 0.0})
    dimensions: dict = field(default_factory=lambda: {"w": 0.1, "h": 0.1, "d": 0.1})
    confidence: float = 1.0
    last_seen: float = field(default_factory=time.time)
    interaction_history: list[dict] = field(default_factory=list)


@dataclass
class WorldSnapshot:
    """Point-in-time snapshot of the world state."""
    snapshot_id: str
    timestamp: float
    objects: dict[str, WorldObject]
    robot_poses: dict[str, dict]
    metadata: dict = field(default_factory=dict)


class WorldStateEngine:
    """
    Persistent environment memory engine.

    Maintains an always-current, queryable model of the robot's world.
    Supports spatial queries, object history, and scene understanding.
    """

    def __init__(self):
        self._objects: dict[str, WorldObject] = {}
        self._snapshots: list[WorldSnapshot] = []
        self._robot_poses: dict[str, dict] = {}
        self._snapshot_interval = 10.0  # seconds
        self._last_snapshot = time.time()

    # ─── Object Management ────────────────────────────────────────────────

    def upsert_object(self, obj: WorldObject):
        """
        Insert or update a tracked world object.
        Preserves interaction history across updates.
        """
        if obj.object_id in self._objects:
            existing = self._objects[obj.object_id]
            obj.interaction_history = existing.interaction_history
        self._objects[obj.object_id] = obj
        self._auto_snapshot()

    def remove_object(self, object_id: str):
        """Remove an object from the world model when it's no longer detected."""
        self._objects.pop(object_id, None)

    def record_interaction(self, object_id: str, robot_id: str, action: str):
        """Log a robot-object interaction into the object's history."""
        if object_id not in self._objects:
            return
        self._objects[object_id].interaction_history.append({
            "robot_id": robot_id,
            "action": action,
            "timestamp": time.time(),
        })

    # ─── Spatial Queries ──────────────────────────────────────────────────

    def get_objects_in_radius(
        self, center: dict, radius: float, object_class: Optional[ObjectClass] = None
    ) -> list[WorldObject]:
        """Return all objects within a given radius of a 3D center point."""
        results = []
        for obj in self._objects.values():
            dx = obj.position["x"] - center["x"]
            dy = obj.position["y"] - center["y"]
            dz = obj.position.get("z", 0) - center.get("z", 0)
            dist = (dx**2 + dy**2 + dz**2) ** 0.5
            if dist <= radius:
                if object_class is None or obj.object_class == object_class:
                    results.append(obj)
        return results

    def get_nearest_object(
        self, position: dict, object_class: Optional[ObjectClass] = None
    ) -> Optional[WorldObject]:
        """Find the closest object to a given position."""
        candidates = list(self._objects.values())
        if object_class:
            candidates = [o for o in candidates if o.object_class == object_class]
        if not candidates:
            return None
        return min(candidates, key=lambda o: (
            (o.position["x"] - position["x"])**2 +
            (o.position["y"] - position["y"])**2
        ) ** 0.5)

    def get_by_label(self, label: str) -> list[WorldObject]:
        """Query all objects matching a semantic label."""
        return [o for o in self._objects.values() if o.label == label]

    # ─── Robot Pose Tracking ──────────────────────────────────────────────

    def update_robot_pose(self, robot_id: str, pose: dict):
        """Update the tracked pose of a robot in the world model."""
        self._robot_poses[robot_id] = {**pose, "timestamp": time.time()}

    def get_robot_pose(self, robot_id: str) -> Optional[dict]:
        return self._robot_poses.get(robot_id)

    # ─── Snapshots ────────────────────────────────────────────────────────

    def take_snapshot(self, metadata: dict = {}) -> WorldSnapshot:
        """Capture the current world state as a named snapshot."""
        snapshot = WorldSnapshot(
            snapshot_id=f"snap_{int(time.time())}",
            timestamp=time.time(),
            objects=dict(self._objects),
            robot_poses=dict(self._robot_poses),
            metadata=metadata,
        )
        self._snapshots.append(snapshot)
        return snapshot

    def get_snapshots(self) -> list[WorldSnapshot]:
        return self._snapshots

    def _auto_snapshot(self):
        """Automatically snapshot the world state at regular intervals."""
        now = time.time()
        if now - self._last_snapshot >= self._snapshot_interval:
            self.take_snapshot({"trigger": "auto"})
            self._last_snapshot = now

    # ─── Scene Summary ────────────────────────────────────────────────────

    def get_scene_summary(self) -> dict:
        """Return a high-level summary of the current world state."""
        return {
            "total_objects": len(self._objects),
            "by_class": {
                cls.value: len([o for o in self._objects.values() if o.object_class == cls])
                for cls in ObjectClass
            },
            "active_robots": list(self._robot_poses.keys()),
            "total_snapshots": len(self._snapshots),
        }
