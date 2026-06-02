from dataclasses import dataclass
from math import isfinite

from core.schemas.enums import JointType
from core.schemas.motion import validate_joint_node


@dataclass(frozen=True)
class JointNode:
    id: int
    joint_type: JointType
    x: float
    y: float
    z: float
    confidence: float = 1.0

    def __post_init__(self) -> None:
        coordinates = (self.x, self.y, self.z)
        if not all(isfinite(value) for value in coordinates):
            raise ValueError("Joint coordinates must be finite numbers")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("Joint confidence must be between 0.0 and 1.0")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "joint_type": self.joint_type.value,
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "confidence": self.confidence,
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "JointNode":
        validated = validate_joint_node(payload)
        return cls(
            id=validated["id"],
            joint_type=JointType(validated["joint_type"]),
            x=validated["x"],
            y=validated["y"],
            z=validated["z"],
            confidence=validated["confidence"],
        )
