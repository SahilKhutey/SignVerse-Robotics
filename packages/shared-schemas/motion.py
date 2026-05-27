from pydantic import BaseModel
from typing import List
from .skeleton import SkeletonFrame

class MotionSequence(BaseModel):
    sequence_id: str
    fps: int
    duration: float
    frames: List[SkeletonFrame]
