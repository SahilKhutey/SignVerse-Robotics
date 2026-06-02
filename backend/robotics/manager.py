from typing import Dict, Any

class RobotHardwareInterface:
    """Base class for all robot connections (Serial, ROS, WebSocket)"""
    def connect(self) -> bool:
        raise NotImplementedError
    
    def disconnect(self) -> bool:
        raise NotImplementedError

    def send_pose(self, joint_angles: Dict[str, float]) -> bool:
        raise NotImplementedError

class DummyWebSocketRobot(RobotHardwareInterface):
    """A simulated robot that just returns telemetry."""
    def __init__(self, name="Virtual_Bot_1"):
        self.name = name
        self.connected = False
        self.current_angles = {}

    def connect(self):
        print(f"[Robotics] Connected to {self.name}")
        self.connected = True
        return True

    def disconnect(self):
        print(f"[Robotics] Disconnected from {self.name}")
        self.connected = False
        return True

    def send_pose(self, joint_angles: Dict[str, float]):
        if not self.connected:
            return False
        
        self.current_angles = joint_angles
        # In a real robot, we would send this over serial/websockets here.
        return True

class RoboticsCommandBus:
    """Central registry for all active robots."""
    def __init__(self):
        self.active_robots: Dict[str, RobotHardwareInterface] = {}
        # Alias for test suite compatibility
        self.robots = self.active_robots
        
    def register_robot(self, robot_id: str, robot: RobotHardwareInterface):
        self.active_robots[robot_id] = robot
        robot.connect()
        
    def register(self, robot: RobotHardwareInterface):
        """Compat registration mapping robot.name directly."""
        self.register_robot(robot.name, robot)

    def get_robot(self, robot_id: str) -> RobotHardwareInterface:
        return self.active_robots.get(robot_id)

    def broadcast_pose(self, joint_angles: Dict[str, float]):
        for robot_id, robot in self.active_robots.items():
            robot.send_pose(joint_angles)

# Global singleton
robot_bus = RoboticsCommandBus()
# Register a dummy robot by default for Digital Twin
robot_bus.register_robot("digital_twin_1", DummyWebSocketRobot())

