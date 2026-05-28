from dataclasses import dataclass

@dataclass
class RobotJoint:

    name: str
    parent: str = None

    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    min_angle: float = -180.0
    max_angle: float = 180.0
