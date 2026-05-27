from pydantic import BaseModel
from typing import List
from .frame_schema import FrameData

class MotionSequence(BaseModel):
    video_id: str
    fps: float
    total_frames: int
    frames: List[FrameData]
