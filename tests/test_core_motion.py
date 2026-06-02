import pytest
import uuid
from pathlib import Path

from core.schemas.enums import JointType
from core.schemas.motion import (
    MOTION_SEQUENCE_SCHEMA_VERSION,
    SchemaValidationError,
    motion_sequence_json_schema,
    validate_motion_sequence,
)
from core.skeleton.joint import JointNode
from core.skeleton.skeleton_graph import SkeletonGraph
from core.motion.frame import MotionFrame
from core.motion.sequence import MotionSequence
from core.motion.serializer import MotionSerializer


def test_serialization():
    # Build a minimal SkeletonGraph
    graph = SkeletonGraph()
    shoulder = JointNode(id=1, joint_type=JointType.RIGHT_SHOULDER, x=1.0, y=2.0, z=0.0, confidence=0.99)
    elbow = JointNode(id=2, joint_type=JointType.RIGHT_ELBOW, x=1.0, y=1.0, z=0.0, confidence=0.95)
    
    graph.add_joint(shoulder)
    graph.add_joint(elbow)
    graph.connect(JointType.RIGHT_SHOULDER, JointType.RIGHT_ELBOW)
    
    # Create a frame
    frame = MotionFrame(frame_id=0, timestamp=0.0, skeleton=graph)
    
    # Create sequence
    seq = MotionSequence(sequence_id="test_seq_001", metadata={"source": "unit-test"})
    seq.add_frame(frame)
    
    # Serialize
    test_path = Path(".tmp_test_artifacts") / f"motion_{uuid.uuid4().hex}" / "test_output.json"
    MotionSerializer.save(seq, test_path)
    
    # Verify file exists and is valid json
    assert test_path.exists()
    
    loaded = MotionSerializer.load(test_path)
    assert loaded["schema_version"] == MOTION_SEQUENCE_SCHEMA_VERSION
    assert loaded["sequence_id"] == "test_seq_001"
    assert len(loaded["frames"]) == 1
    assert loaded["metadata"]["source"] == "unit-test"
    
    f0 = loaded["frames"][0]
    assert f0["frame_id"] == 0
    assert "right_shoulder" in f0["skeleton"]
    assert f0["skeleton"]["right_shoulder"]["x"] == 1.0

    loaded_sequence = MotionSerializer.load_sequence(test_path)
    assert loaded_sequence.schema_version == MOTION_SEQUENCE_SCHEMA_VERSION
    assert loaded_sequence.sequence_id == seq.sequence_id
    assert loaded_sequence.metadata == {"source": "unit-test"}
    assert loaded_sequence.frames[0].skeleton.joints[JointType.RIGHT_ELBOW].confidence == 0.95


def test_motion_contract_validation():
    with pytest.raises(ValueError, match="confidence"):
        JointNode(
            id=1,
            joint_type=JointType.RIGHT_WRIST,
            x=0.0,
            y=0.0,
            z=0.0,
            confidence=1.5,
        )

    sequence = MotionSequence(sequence_id="ordered")
    graph = SkeletonGraph()
    graph.add_joint(
        JointNode(
            id=1,
            joint_type=JointType.RIGHT_WRIST,
            x=0.0,
            y=0.0,
            z=0.0,
        )
    )
    sequence.add_frame(MotionFrame(frame_id=0, timestamp=1.0, skeleton=graph))

    with pytest.raises(ValueError, match="monotonic"):
        sequence.add_frame(MotionFrame(frame_id=1, timestamp=0.5, skeleton=graph))


def test_motion_schema_validation_and_export():
    schema = motion_sequence_json_schema()
    assert schema["properties"]["schema_version"]["const"] == MOTION_SEQUENCE_SCHEMA_VERSION
    assert "motion_frame" in schema["$defs"]

    payload = {
        "sequence_id": "schema_roundtrip",
        "fps": 60,
        "frames": [
            {
                "frame_id": 0,
                "timestamp": 0.0,
                "skeleton": {
                    "right_wrist": {
                        "id": 1,
                        "joint_type": "right_wrist",
                        "x": 0,
                        "y": 1,
                        "z": 2,
                        "confidence": 1,
                    }
                },
            }
        ],
        "metadata": {"source": "schema-test"},
    }

    validated = validate_motion_sequence(payload)
    assert validated["schema_version"] == MOTION_SEQUENCE_SCHEMA_VERSION
    assert validated["frames"][0]["skeleton"]["right_wrist"]["x"] == 0.0

    payload["frames"][0]["skeleton"]["right_wrist"]["joint_type"] = "left_wrist"
    with pytest.raises(SchemaValidationError, match="joint key"):
        validate_motion_sequence(payload)

if __name__ == "__main__":
    test_serialization()
