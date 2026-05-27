from pydantic import BaseModel
from typing import List

class FrameData(BaseModel):
    frame_index: int
    timestamp: float
    landmarks: List[dict]
