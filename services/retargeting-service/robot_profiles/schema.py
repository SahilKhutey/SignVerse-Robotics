from pydantic import BaseModel
from typing import List, Dict

class RobotProfile(BaseModel):
    robot_name: str
    joint_names: List[str]
    joint_limits: Dict[str, dict]
    bone_lengths: Dict[str, float]
    coordinate_system: str
