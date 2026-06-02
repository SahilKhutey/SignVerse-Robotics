from dataclasses import dataclass

from core.skeleton.skeleton_graph import SkeletonGraph


@dataclass(frozen=True)
class MotionFrame:
    frame_id: int
    timestamp: float
    skeleton: SkeletonGraph

    def __post_init__(self) -> None:
        if self.frame_id < 0:
            raise ValueError("frame_id must be non-negative")
        if self.timestamp < 0:
            raise ValueError("timestamp must be non-negative")

    def to_dict(self) -> dict:
        return {
            "frame_id": self.frame_id,
            "timestamp": self.timestamp,
            "skeleton": self.skeleton.to_dict(),
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "MotionFrame":
        return cls(
            frame_id=int(payload["frame_id"]),
            timestamp=float(payload["timestamp"]),
            skeleton=SkeletonGraph.from_dict(payload["skeleton"]),
        )
