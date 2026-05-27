from pydantic import BaseModel
from typing import List

class Joint(BaseModel):
    joint_id: int
    joint_name: str
    position_2d: List[float]
    position_3d: List[float]
    rotation_quaternion: List[float]
    confidence: float

class SkeletonFrame(BaseModel):
    frame_index: int
    timestamp: float
    joints: List[Joint]
