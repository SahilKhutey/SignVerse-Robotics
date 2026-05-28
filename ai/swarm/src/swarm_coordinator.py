"""
SignVerse Swarm Coordination Engine — Phase 10.2
=================================================
Multi-agent robotics coordination system.

Enables:
  - Cooperative task execution across robot fleets
  - Shared world state synchronization
  - Formation movement coordination
  - Distributed sensing and inference
  - Task allocation with capability matching

Communication Stack:
  NATS JetStream (primary) → ROS2 DDS → MQTT (edge fallback)
"""

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


# ─── Robot Registry ───────────────────────────────────────────────────────────

class RobotCapability(Enum):
    NAVIGATION      = "navigation"
    MANIPULATION    = "manipulation"
    GESTURE_AI      = "gesture_ai"
    VISION          = "vision"
    LIDAR           = "lidar"
    SPEECH          = "speech"
    HEAVY_LIFT      = "heavy_lift"
    AERIAL          = "aerial"


class RobotStatus(Enum):
    IDLE       = "idle"
    BUSY       = "busy"
    CHARGING   = "charging"
    ERROR      = "error"
    ESTOP      = "estop"
    OFFLINE    = "offline"


@dataclass
class RobotAgent:
    """A registered robot agent in the swarm."""
    robot_id: str
    name: str
    capabilities: set[RobotCapability]
    status: RobotStatus = RobotStatus.IDLE
    current_task_id: Optional[str] = None
    battery_percent: float = 100.0
    position: dict = field(default_factory=lambda: {"x": 0.0, "y": 0.0, "z": 0.0})
    last_heartbeat: float = field(default_factory=time.time)


# ─── Task Distribution ────────────────────────────────────────────────────────

class TaskPriority(Enum):
    LOW      = 1
    NORMAL   = 2
    HIGH     = 3
    CRITICAL = 4
    EMERGENCY = 5


@dataclass
class SwarmTask:
    """A task that can be distributed across the robot swarm."""
    task_id: str
    description: str
    required_capabilities: set[RobotCapability]
    priority: TaskPriority
    payload: dict = field(default_factory=dict)
    assigned_robot_id: Optional[str] = None
    status: str = "pending"          # pending | assigned | active | done | failed
    created_at: float = field(default_factory=time.time)
    deadline: Optional[float] = None
    requires_collaboration: bool = False
    collaborating_robots: list[str] = field(default_factory=list)


# ─── Shared World State ───────────────────────────────────────────────────────

@dataclass
class SharedWorldState:
    """
    Distributed world state shared across all robots.
    Acts as the swarm's collective memory of the environment.
    """
    map_data: dict = field(default_factory=dict)          # Grid map
    dynamic_obstacles: list[dict] = field(default_factory=list)
    ai_predictions: list[dict] = field(default_factory=list)
    mission_progress: dict = field(default_factory=dict)  # task_id → progress %
    robot_poses: dict = field(default_factory=dict)       # robot_id → pose
    last_updated: float = field(default_factory=time.time)


# ─── Swarm Coordination Engine ────────────────────────────────────────────────

class SwarmCoordinationEngine:
    """
    Central swarm coordination engine.

    Manages:
      - Robot fleet registration and heartbeat monitoring
      - Capability-based task allocation
      - Formation movement coordination
      - Shared world state synchronization
      - Collaborative task orchestration
    """

    HEARTBEAT_TIMEOUT = 10.0  # seconds before robot is considered offline

    def __init__(self, fleet_id: str):
        self.fleet_id = fleet_id
        self._robots: dict[str, RobotAgent] = {}
        self._task_queue: list[SwarmTask] = []
        self._shared_state = SharedWorldState()
        self._task_callbacks: list[Callable] = []
        self._state_update_callbacks: list[Callable] = []

    # ─── Fleet Management ─────────────────────────────────────────────────

    def register_robot(self, robot: RobotAgent):
        """Register a robot into the fleet."""
        self._robots[robot.robot_id] = robot
        print(f"[Swarm] Robot registered: {robot.robot_id} | Capabilities: {[c.value for c in robot.capabilities]}")

    def heartbeat(self, robot_id: str, status: RobotStatus, battery: float, position: dict):
        """Process a heartbeat from a robot agent."""
        robot = self._robots.get(robot_id)
        if not robot:
            return
        robot.last_heartbeat = time.time()
        robot.status = status
        robot.battery_percent = battery
        robot.position = position
        self._shared_state.robot_poses[robot_id] = position
        self._shared_state.last_updated = time.time()

    def prune_offline_robots(self):
        """Mark robots as offline if heartbeat has timed out."""
        now = time.time()
        for robot in self._robots.values():
            if now - robot.last_heartbeat > self.HEARTBEAT_TIMEOUT:
                if robot.status not in (RobotStatus.OFFLINE, RobotStatus.ESTOP):
                    print(f"[Swarm] Robot {robot.robot_id} heartbeat lost — marking OFFLINE")
                    robot.status = RobotStatus.OFFLINE

    # ─── Task Allocation ──────────────────────────────────────────────────

    def submit_task(self, task: SwarmTask) -> str:
        """Submit a task for swarm allocation."""
        self._task_queue.append(task)
        self._task_queue.sort(key=lambda t: -t.priority.value)
        print(f"[Swarm] Task submitted: {task.description} (priority={task.priority.name})")
        return task.task_id

    def allocate_tasks(self) -> list[tuple[str, str]]:
        """
        Allocate pending tasks to available robots based on capability matching.
        Returns a list of (task_id, robot_id) assignments.
        """
        assignments = []
        available_robots = [
            r for r in self._robots.values()
            if r.status == RobotStatus.IDLE and r.battery_percent > 10
        ]

        for task in self._task_queue:
            if task.status != "pending":
                continue

            # Find capable robot
            for robot in available_robots:
                if task.required_capabilities.issubset(robot.capabilities):
                    task.assigned_robot_id = robot.robot_id
                    task.status = "assigned"
                    robot.status = RobotStatus.BUSY
                    robot.current_task_id = task.task_id
                    assignments.append((task.task_id, robot.robot_id))
                    available_robots.remove(robot)

                    for cb in self._task_callbacks:
                        cb(task, robot)
                    break

        return assignments

    def complete_task(self, task_id: str, success: bool):
        """Mark a task as complete and free the assigned robot."""
        task = next((t for t in self._task_queue if t.task_id == task_id), None)
        if not task:
            return
        task.status = "done" if success else "failed"
        self._shared_state.mission_progress[task_id] = 100 if success else -1
        if task.assigned_robot_id:
            robot = self._robots.get(task.assigned_robot_id)
            if robot:
                robot.status = RobotStatus.IDLE
                robot.current_task_id = None

    # ─── Formation Movement ───────────────────────────────────────────────

    def compute_formation(
        self,
        robot_ids: list[str],
        formation_type: str,   # "line" | "V" | "circle" | "grid"
        lead_position: dict,
        spacing: float = 1.5,
    ) -> dict[str, dict]:
        """
        Compute target positions for a robot formation.
        Returns a dict mapping robot_id → target_position.
        """
        positions: dict[str, dict] = {}
        if not robot_ids:
            return positions

        if formation_type == "line":
            for i, rid in enumerate(robot_ids):
                positions[rid] = {
                    "x": lead_position["x"] - (i * spacing),
                    "y": lead_position["y"],
                    "z": 0.0,
                }
        elif formation_type == "V":
            positions[robot_ids[0]] = lead_position
            for i, rid in enumerate(robot_ids[1:]):
                side = 1 if i % 2 == 0 else -1
                offset = (i // 2 + 1) * spacing
                positions[rid] = {
                    "x": lead_position["x"] - offset,
                    "y": lead_position["y"] + side * offset * 0.7,
                    "z": 0.0,
                }
        elif formation_type == "circle":
            import math
            n = len(robot_ids)
            for i, rid in enumerate(robot_ids):
                angle = 2 * math.pi * i / n
                positions[rid] = {
                    "x": lead_position["x"] + spacing * math.cos(angle),
                    "y": lead_position["y"] + spacing * math.sin(angle),
                    "z": 0.0,
                }
        else:
            # Default: cluster around leader
            for i, rid in enumerate(robot_ids):
                positions[rid] = {
                    "x": lead_position["x"] + (i % 3) * spacing,
                    "y": lead_position["y"] + (i // 3) * spacing,
                    "z": 0.0,
                }

        return positions

    # ─── Shared State Sync ────────────────────────────────────────────────

    def update_shared_state(self, key: str, value):
        """Broadcast a world state update to all robots via event bus."""
        setattr(self._shared_state, key, value)
        self._shared_state.last_updated = time.time()
        for cb in self._state_update_callbacks:
            cb(key, value)

    def get_shared_state(self) -> SharedWorldState:
        return self._shared_state

    def on_task_assigned(self, callback: Callable):
        self._task_callbacks.append(callback)

    def on_state_updated(self, callback: Callable):
        self._state_update_callbacks.append(callback)

    def fleet_summary(self) -> dict:
        return {
            "fleet_id": self.fleet_id,
            "total_robots": len(self._robots),
            "by_status": {
                s.value: sum(1 for r in self._robots.values() if r.status == s)
                for s in RobotStatus
            },
            "pending_tasks": sum(1 for t in self._task_queue if t.status == "pending"),
            "active_tasks": sum(1 for t in self._task_queue if t.status == "active"),
        }
