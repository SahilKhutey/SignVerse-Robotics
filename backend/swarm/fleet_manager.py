from typing import Dict, Any

class FleetManager:
    """
    Manages a distributed swarm of robots.
    Allows multiple hardware units to coordinate within the same World Model.
    """
    def __init__(self):
        self.fleet: Dict[str, Any] = {}

    def register_node(self, robot_id: str, capabilities: list):
        print(f"[FleetManager] Registering Swarm Node: {robot_id}")
        self.fleet[robot_id] = {
            "id": robot_id,
            "status": "IDLE",
            "capabilities": capabilities,
            "current_task": None,
            "health": 100
        }

    def assign_task(self, robot_id: str, task: dict):
        if robot_id in self.fleet:
            self.fleet[robot_id]["current_task"] = task
            self.fleet[robot_id]["status"] = "WORKING"
            print(f"[FleetManager] Assigned task to {robot_id}: {task}")

    def get_fleet_status(self):
        return {
            "active_nodes": len(self.fleet),
            "nodes": self.fleet
        }

swarm_coordinator = FleetManager()
