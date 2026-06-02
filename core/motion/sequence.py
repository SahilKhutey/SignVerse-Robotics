from core.motion.frame import MotionFrame
from core.schemas.motion import (
    MOTION_SEQUENCE_SCHEMA_VERSION,
    validate_motion_sequence,
)


class MotionSequence:
    def __init__(
        self,
        sequence_id: str,
        fps: int = 30,
        metadata: dict | None = None,
        schema_version: str = MOTION_SEQUENCE_SCHEMA_VERSION,
    ):
        if not sequence_id:
            raise ValueError("sequence_id is required")
        if fps <= 0:
            raise ValueError("fps must be greater than zero")
        if schema_version != MOTION_SEQUENCE_SCHEMA_VERSION:
            raise ValueError(f"unsupported schema_version: {schema_version}")
        self.schema_version = schema_version
        self.sequence_id = sequence_id
        self.fps = fps
        self.metadata = metadata or {}
        self.frames: list[MotionFrame] = []

    def add_frame(self, frame: MotionFrame) -> None:
        if self.frames and frame.timestamp < self.frames[-1].timestamp:
            raise ValueError("MotionFrame timestamps must be monotonic")
        self.frames.append(frame)

    @property
    def duration_seconds(self) -> float:
        if not self.frames:
            return 0.0
        return self.frames[-1].timestamp - self.frames[0].timestamp

    def to_dict(self) -> dict:
        return {
            "schema_version": self.schema_version,
            "sequence_id": self.sequence_id,
            "fps": self.fps,
            "frames": [frame.to_dict() for frame in self.frames],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "MotionSequence":
        validated = validate_motion_sequence(payload)
        sequence = cls(
            sequence_id=validated["sequence_id"],
            fps=validated["fps"],
            metadata=validated["metadata"],
            schema_version=validated["schema_version"],
        )
        for frame_payload in validated["frames"]:
            sequence.add_frame(MotionFrame.from_dict(frame_payload))
        return sequence
