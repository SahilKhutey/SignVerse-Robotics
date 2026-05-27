from pydantic import BaseModel
from typing import List

class TrackingFrame(BaseModel):
    track_id: str
    person_id: str
    timestamps: List[float]
