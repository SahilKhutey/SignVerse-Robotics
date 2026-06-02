import json
from pathlib import Path

from core.motion.sequence import MotionSequence
from core.schemas.motion import validate_motion_sequence


class MotionSerializer:
    @staticmethod
    def save(sequence: MotionSequence, path: str | Path) -> None:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = validate_motion_sequence(sequence.to_dict())
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @staticmethod
    def load(path: str | Path) -> dict:
        input_path = Path(path)
        return validate_motion_sequence(json.loads(input_path.read_text(encoding="utf-8")))

    @staticmethod
    def load_sequence(path: str | Path) -> MotionSequence:
        return MotionSequence.from_dict(MotionSerializer.load(path))
