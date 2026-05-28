"""
SignVerse World Model Engine — Phase 10.1
==========================================
Predictive environmental intelligence system.

This is the robot's internal model of reality. It maintains:
  - Spatial understanding: where objects are
  - Temporal understanding: how things change over time
  - Predictive modeling: what will happen next

Architecture:
  Sensor Stream → Perception → Scene Graph → Temporal State → Prediction
"""

import math
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class EntityType(Enum):
    STATIC_OBSTACLE = "static_obstacle"
    DYNAMIC_OBSTACLE = "dynamic_obstacle"
    HUMAN = "human"
    ROBOT = "robot"
    GOAL_TARGET = "goal_target"
    SEMANTIC_ZONE = "semantic_zone"


@dataclass
class Pose3D:
    """6-DOF pose in world space."""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0


@dataclass
class Velocity3D:
    """Linear + angular velocity."""
    vx: float = 0.0
    vy: float = 0.0
    vz: float = 0.0
    omega: float = 0.0  # Angular velocity (rad/s)


@dataclass
class WorldEntity:
    """
    A tracked entity in the world model.
    Maintains a velocity history for trajectory prediction.
    """
    entity_id: str
    entity_type: EntityType
    pose: Pose3D
    velocity: Velocity3D = field(default_factory=Velocity3D)
    dimensions: dict = field(default_factory=lambda: {"w": 0.5, "h": 0.5, "d": 0.5})
    confidence: float = 1.0
    last_updated: float = field(default_factory=time.time)

    # Temporal history for prediction (ring buffer of last 30 poses)
    pose_history: deque = field(default_factory=lambda: deque(maxlen=30))


@dataclass
class PredictedState:
    """A predicted future state of an entity."""
    entity_id: str
    predicted_pose: Pose3D
    prediction_horizon_s: float
    confidence: float
    collision_risk: float  # 0.0 (none) → 1.0 (imminent)


class WorldModelEngine:
    """
    Predictive World Model Engine for SignVerse robots.

    Maintains a live scene graph and generates short-horizon predictions
    for navigation planning and collision avoidance.

    Integration points:
      - Sensor Fusion (IMU + Lidar + Camera) → update_entity()
      - Navigation Engine → get_predicted_states()
      - Planning Engine → get_scene_graph()
    """

    COLLISION_DISTANCE_THRESHOLD = 0.8  # meters

    def __init__(self, robot_id: str):
        self.robot_id = robot_id
        self._entities: dict[str, WorldEntity] = {}
        self._scene_graph: dict[str, list[str]] = {}  # entity → related entities
        self._stale_timeout = 5.0  # seconds before entity is considered stale

    # ─── Entity Updates ───────────────────────────────────────────────────

    def update_entity(self, entity: WorldEntity):
        """
        Ingest a new sensor observation of a world entity.
        Automatically computes velocity from position delta.
        """
        existing = self._entities.get(entity.entity_id)
        if existing:
            dt = entity.last_updated - existing.last_updated
            if dt > 0:
                entity.velocity = Velocity3D(
                    vx=(entity.pose.x - existing.pose.x) / dt,
                    vy=(entity.pose.y - existing.pose.y) / dt,
                    vz=(entity.pose.z - existing.pose.z) / dt,
                )
            entity.pose_history = existing.pose_history
        entity.pose_history.append({"pose": entity.pose, "t": entity.last_updated})
        self._entities[entity.entity_id] = entity
        self._update_scene_graph(entity)

    def remove_entity(self, entity_id: str):
        self._entities.pop(entity_id, None)
        self._scene_graph.pop(entity_id, None)

    def prune_stale_entities(self):
        """Remove entities not observed within the stale timeout."""
        now = time.time()
        stale = [
            eid for eid, e in self._entities.items()
            if now - e.last_updated > self._stale_timeout
        ]
        for eid in stale:
            self.remove_entity(eid)

    # ─── Prediction Engine ────────────────────────────────────────────────

    def predict_entity_state(
        self, entity_id: str, horizon_s: float = 2.0
    ) -> Optional[PredictedState]:
        """
        Predict where an entity will be in `horizon_s` seconds.
        Uses constant-velocity model (extendable to learned transformer model).
        """
        entity = self._entities.get(entity_id)
        if not entity:
            return None

        # Constant velocity prediction
        predicted = Pose3D(
            x=entity.pose.x + entity.velocity.vx * horizon_s,
            y=entity.pose.y + entity.velocity.vy * horizon_s,
            z=entity.pose.z + entity.velocity.vz * horizon_s,
            yaw=entity.pose.yaw + entity.velocity.omega * horizon_s,
        )

        # Degrade confidence over longer horizons
        confidence = max(0.1, entity.confidence * (1.0 - horizon_s * 0.15))

        collision_risk = self._compute_collision_risk(predicted)

        return PredictedState(
            entity_id=entity_id,
            predicted_pose=predicted,
            prediction_horizon_s=horizon_s,
            confidence=confidence,
            collision_risk=collision_risk,
        )

    def get_predicted_states(
        self, horizon_s: float = 2.0
    ) -> list[PredictedState]:
        """Predict future states for all dynamic entities."""
        predictions = []
        for eid, entity in self._entities.items():
            if entity.entity_type in (EntityType.DYNAMIC_OBSTACLE, EntityType.HUMAN):
                pred = self.predict_entity_state(eid, horizon_s)
                if pred:
                    predictions.append(pred)
        return predictions

    def _compute_collision_risk(self, predicted_pose: Pose3D) -> float:
        """Compute collision risk between a predicted pose and the robot's current position."""
        robot = self._entities.get(self.robot_id)
        if not robot:
            return 0.0
        dist = math.sqrt(
            (predicted_pose.x - robot.pose.x) ** 2 +
            (predicted_pose.y - robot.pose.y) ** 2
        )
        if dist < self.COLLISION_DISTANCE_THRESHOLD:
            return 1.0 - (dist / self.COLLISION_DISTANCE_THRESHOLD)
        return 0.0

    # ─── Scene Graph ──────────────────────────────────────────────────────

    def _update_scene_graph(self, entity: WorldEntity, proximity_threshold: float = 3.0):
        """Update the scene graph with proximity relationships."""
        related = []
        for other_id, other in self._entities.items():
            if other_id == entity.entity_id:
                continue
            dist = math.sqrt(
                (entity.pose.x - other.pose.x) ** 2 +
                (entity.pose.y - other.pose.y) ** 2
            )
            if dist <= proximity_threshold:
                related.append(other_id)
        self._scene_graph[entity.entity_id] = related

    def get_scene_graph(self) -> dict:
        return dict(self._scene_graph)

    def get_high_risk_entities(self, threshold: float = 0.7) -> list[PredictedState]:
        """Return all predicted states with collision risk above threshold."""
        predictions = self.get_predicted_states(horizon_s=1.5)
        return [p for p in predictions if p.collision_risk >= threshold]

    def summarize(self) -> dict:
        return {
            "robot_id": self.robot_id,
            "tracked_entities": len(self._entities),
            "scene_graph_nodes": len(self._scene_graph),
            "entity_breakdown": {
                t.value: sum(1 for e in self._entities.values() if e.entity_type == t)
                for t in EntityType
            },
        }
