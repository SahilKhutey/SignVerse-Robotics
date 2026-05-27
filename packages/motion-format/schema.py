from pydantic import BaseModel
from typing import List, Dict, Optional

class Vector3D(BaseModel):
    x: float
    y: float
    z: float = 0.0

class PersonMotion(BaseModel):
    track_id: int
    pose: List[dict]
    hands: List[dict]
    face: List[dict]
    velocity: Dict[str, Vector3D]
    acceleration: Dict[str, Vector3D]

class UniversalFrame(BaseModel):
    frame_index: int
    timestamp: float
    persons: List[PersonMotion]

class UniversalMotion(BaseModel):
    video_id: str
    fps: float
    frames: List[UniversalFrame]
