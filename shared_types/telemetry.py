from typing import List
from pydantic import BaseModel, field_validator

class PoseLandmark(BaseModel):
    x: float
    y: float
    z: float
    visibility: float

class TelemetryFrame(BaseModel):
    joint_angles: List[float]
    pose_landmarks: List[PoseLandmark]
    ai_prediction: List[float]
    confidence: float
    timestamp_ms: int

    @field_validator("joint_angles")
    @classmethod
    def check_joint_angles(cls, v):
        if len(v) != 7:
            raise ValueError("joint_angles must have length 7")
        return v

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v):
        if not (0.0 <= v <= 1.0):
            raise ValueError("confidence must be between 0 and 1")
        return v

    @field_validator("timestamp_ms")
    @classmethod
    def check_timestamp(cls, v):
        if v <= 0:
            raise ValueError("timestamp_ms must be > 0")
        return v
