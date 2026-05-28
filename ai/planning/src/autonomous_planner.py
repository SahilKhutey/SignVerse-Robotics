"""
SignVerse Autonomous Planning Engine — Phase 10.1
===================================================
Converts high-level goals into executable robot action sequences.

Architecture:
  Goal (Natural Language / Structured) 
  → Goal Decomposer 
  → Task Graph
  → Action Sequences
  → Motor Commands

Supports:
  - Navigation planning (A* + dynamic replanning)
  - Manipulation planning (pick/place sequences)
  - Mission planning (multi-step orchestration)
  - Collaborative planning (multi-robot)
"""

import time
import heapq
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


# ─── Goal Hierarchy ───────────────────────────────────────────────────────────

class GoalLevel(Enum):
    STRATEGIC = 0   # "Clean the entire warehouse"
    MISSION   = 1   # "Navigate to Zone B and pick up objects"
    TASK      = 2   # "Move to position (3.5, 2.1)"
    MOTOR     = 3   # "Apply velocity: linear=0.5, angular=0.1"


class GoalStatus(Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    SUCCEEDED = "succeeded"
    FAILED    = "failed"
    ABORTED   = "aborted"


@dataclass(order=True)
class Goal:
    """A single goal in the planning hierarchy."""
    priority: int
    goal_id: str = field(compare=False)
    level: GoalLevel = field(compare=False)
    description: str = field(compare=False)
    parameters: dict = field(default_factory=dict, compare=False)
    status: GoalStatus = field(default=GoalStatus.PENDING, compare=False)
    parent_goal_id: Optional[str] = field(default=None, compare=False)
    sub_goals: list["Goal"] = field(default_factory=list, compare=False)
    created_at: float = field(default_factory=time.time, compare=False)
    deadline: Optional[float] = field(default=None, compare=False)


@dataclass
class ActionStep:
    """A single executable robot action."""
    action_id: str
    action_type: str     # "move", "rotate", "pick", "place", "wait", "signal"
    parameters: dict
    estimated_duration_s: float
    preconditions: list[str] = field(default_factory=list)
    effects: list[str] = field(default_factory=list)


@dataclass
class ActionPlan:
    """A complete ordered action plan for a goal."""
    plan_id: str
    goal_id: str
    steps: list[ActionStep]
    total_estimated_duration_s: float
    confidence: float
    created_at: float = field(default_factory=time.time)


# ─── A* Grid Navigation ───────────────────────────────────────────────────────

class AStarPlanner:
    """
    Grid-based A* pathfinding for robot navigation.
    Integrates with the World Model for dynamic obstacle avoidance.
    """

    def __init__(self, grid_resolution: float = 0.1):
        self.resolution = grid_resolution

    def heuristic(self, a: tuple, b: tuple) -> float:
        """Manhattan distance heuristic."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def plan(
        self,
        start: tuple[float, float],
        goal: tuple[float, float],
        obstacles: set[tuple[int, int]],
        grid_size: tuple[int, int] = (200, 200),
    ) -> list[tuple[float, float]]:
        """
        Compute the shortest collision-free path from start to goal.

        Args:
            start: World-space (x, y) start position.
            goal:  World-space (x, y) goal position.
            obstacles: Set of grid cells occupied by obstacles.
            grid_size: Grid dimensions (width, height) in cells.

        Returns:
            List of world-space waypoints (x, y).
        """
        def to_grid(pos: tuple[float, float]) -> tuple[int, int]:
            return (int(pos[0] / self.resolution), int(pos[1] / self.resolution))

        def to_world(cell: tuple[int, int]) -> tuple[float, float]:
            return (cell[0] * self.resolution, cell[1] * self.resolution)

        start_g = to_grid(start)
        goal_g = to_grid(goal)

        open_set: list[tuple[float, tuple[int, int]]] = []
        heapq.heappush(open_set, (0, start_g))

        came_from: dict[tuple[int, int], tuple[int, int]] = {}
        g_score: dict[tuple[int, int], float] = {start_g: 0}

        directions = [(0, 1), (1, 0), (0, -1), (-1, 0),
                      (1, 1), (-1, -1), (1, -1), (-1, 1)]

        while open_set:
            _, current = heapq.heappop(open_set)
            if current == goal_g:
                path = []
                while current in came_from:
                    path.append(to_world(current))
                    current = came_from[current]
                path.append(to_world(start_g))
                return list(reversed(path))

            for dx, dy in directions:
                neighbor = (current[0] + dx, current[1] + dy)
                if neighbor in obstacles:
                    continue
                if not (0 <= neighbor[0] < grid_size[0] and 0 <= neighbor[1] < grid_size[1]):
                    continue
                move_cost = 1.414 if dx != 0 and dy != 0 else 1.0
                tent_g = g_score.get(current, float("inf")) + move_cost
                if tent_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tent_g
                    f = tent_g + self.heuristic(neighbor, goal_g)
                    heapq.heappush(open_set, (f, neighbor))

        return []  # No path found


# ─── Autonomous Planning Engine ───────────────────────────────────────────────

class AutonomousPlanningEngine:
    """
    Top-level planning engine.

    Accepts high-level goals and produces executable action plans.
    Supports dynamic replanning when the world state changes.
    """

    def __init__(self, robot_id: str):
        self.robot_id = robot_id
        self._goal_queue: list[Goal] = []
        self._active_plan: Optional[ActionPlan] = None
        self._navigator = AStarPlanner()
        self._failure_handlers: dict[str, Callable] = {}
        self._plan_counter = 0

    def submit_goal(self, goal: Goal):
        """Submit a goal to the planning queue (priority-sorted)."""
        heapq.heappush(self._goal_queue, goal)

    def plan_navigation(
        self,
        goal_position: tuple[float, float],
        current_position: tuple[float, float],
        obstacles: set[tuple[int, int]],
        goal_description: str = "Navigate to target",
    ) -> ActionPlan:
        """
        Generate a navigation action plan using A* pathfinding.
        """
        waypoints = self._navigator.plan(current_position, goal_position, obstacles)

        steps = []
        for i, (wx, wy) in enumerate(waypoints):
            steps.append(ActionStep(
                action_id=f"nav_step_{i}",
                action_type="move",
                parameters={"target_x": wx, "target_y": wy, "tolerance": 0.1},
                estimated_duration_s=0.5,
                preconditions=[] if i == 0 else [f"nav_step_{i-1}_complete"],
                effects=[f"nav_step_{i}_complete"],
            ))

        self._plan_counter += 1
        return ActionPlan(
            plan_id=f"plan_{self.robot_id}_{self._plan_counter}",
            goal_id="nav_goal",
            steps=steps,
            total_estimated_duration_s=len(steps) * 0.5,
            confidence=0.95 if waypoints else 0.0,
        )

    def plan_manipulation(
        self,
        object_id: str,
        action: str,  # "pick" | "place"
        target_pose: dict,
    ) -> ActionPlan:
        """Generate a manipulation action plan for pick/place operations."""
        self._plan_counter += 1
        steps = [
            ActionStep(
                action_id="approach",
                action_type="move",
                parameters={"target": target_pose, "tolerance": 0.05},
                estimated_duration_s=2.0,
                effects=["at_object"],
            ),
            ActionStep(
                action_id="execute_action",
                action_type=action,
                parameters={"object_id": object_id},
                estimated_duration_s=1.5,
                preconditions=["at_object"],
                effects=[f"{action}_complete"],
            ),
            ActionStep(
                action_id="retract",
                action_type="move",
                parameters={"target": "home", "tolerance": 0.1},
                estimated_duration_s=1.5,
                preconditions=[f"{action}_complete"],
                effects=["arm_retracted"],
            ),
        ]

        return ActionPlan(
            plan_id=f"plan_{self.robot_id}_{self._plan_counter}",
            goal_id=f"manip_{object_id}_{action}",
            steps=steps,
            total_estimated_duration_s=5.0,
            confidence=0.90,
        )

    def replan(self, current_position: tuple[float, float], new_obstacles: set):
        """Trigger dynamic replanning due to world state change."""
        if not self._active_plan:
            return
        print(f"[Planner] Replanning triggered for robot {self.robot_id}. New obstacle count: {len(new_obstacles)}")
        # In production: re-submit current goal with updated world state
        self._active_plan = None

    def register_failure_handler(self, action_type: str, handler: Callable):
        """Register a recovery handler for a specific action type failure."""
        self._failure_handlers[action_type] = handler

    def handle_failure(self, action: ActionStep, error: str):
        """Invoke recovery strategy for a failed action."""
        handler = self._failure_handlers.get(action.action_type)
        if handler:
            print(f"[Planner] Invoking recovery for {action.action_type}: {error}")
            handler(action, error)
        else:
            print(f"[Planner] No recovery handler for {action.action_type}. Aborting plan.")
