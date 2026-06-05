import pytest
from pydantic import ValidationError
from shared_types.telemetry import TelemetryFrame, PoseLandmark
from shared_types.ws_message import WSMessage
from shared_types.learning_event import LearningEvent

def test_telemetry_frame_schema():
    # Valid frame
    valid_data = {
        "joint_angles": [0.1] * 7,
        "pose_landmarks": [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 1.0}] * 33,
        "ai_prediction": [0.0] * 7,
        "confidence": 0.8,
        "timestamp_ms": 123456789
    }
    frame = TelemetryFrame(**valid_data)
    assert len(frame.joint_angles) == 7
    assert frame.confidence == 0.8
    assert frame.timestamp_ms > 0

    # Malformed joint_angles length
    invalid_joints = valid_data.copy()
    invalid_joints["joint_angles"] = [0.1] * 6
    with pytest.raises(ValidationError):
        TelemetryFrame(**invalid_joints)

    # Malformed confidence outside [0, 1]
    invalid_confidence = valid_data.copy()
    invalid_confidence["confidence"] = 1.2
    with pytest.raises(ValidationError):
        TelemetryFrame(**invalid_confidence)

    # Malformed timestamp_ms <= 0
    invalid_timestamp = valid_data.copy()
    invalid_timestamp["timestamp_ms"] = 0
    with pytest.raises(ValidationError):
        TelemetryFrame(**invalid_timestamp)

def test_ws_message_discriminated_union():
    # Discriminated union parsing test cases
    telemetry_json = """{
        "type": "telemetry",
        "data": {
            "joint_angles": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            "pose_landmarks": [{"x":0, "y":0, "z":0, "visibility":1}],
            "ai_prediction": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            "confidence": 0.9,
            "timestamp_ms": 100
        }
    }"""
    msg = WSMessage.model_validate_json(telemetry_json)
    assert msg.root.type == "telemetry"
    assert len(msg.root.data.joint_angles) == 7

    landmark_json = """{
        "type": "landmark",
        "data": {
            "landmarks": [{"x": 1.0, "y": 2.0, "z": 3.0, "visibility": 0.99}]
        }
    }"""
    msg = WSMessage.model_validate_json(landmark_json)
    assert msg.root.type == "landmark"
    assert len(msg.root.data.landmarks) == 1

    error_json = """{
        "type": "error",
        "message": "Connection lost"
    }"""
    msg = WSMessage.model_validate_json(error_json)
    assert msg.root.type == "error"
    assert msg.root.message == "Connection lost"

    pong_json = """{
        "type": "pong",
        "ts": 12345
    }"""
    msg = WSMessage.model_validate_json(pong_json)
    assert msg.root.type == "pong"
    assert msg.root.ts == 12345

    rtt_json = """{
        "type": "rtt",
        "rtt_ms": 15
    }"""
    msg = WSMessage.model_validate_json(rtt_json)
    assert msg.root.type == "rtt"
    assert msg.root.rtt_ms == 15

    # Unknown type raises ValidationError
    unknown_json = """{
        "type": "unknown_action",
        "payload": {}
    }"""
    with pytest.raises(ValidationError):
        WSMessage.model_validate_json(unknown_json)

def test_learning_event_types():
    event_data = {
        "type": "update_complete",
        "step": 42,
        "loss": 0.02,
        "val_accuracy": 0.85,
        "per_task_accuracy": {},
        "learning_rate": 1e-4,
        "replay_ratio": 0.2,
        "timestamp_ms": 99999
    }
    # Empty dict should pass
    e1 = LearningEvent(**event_data)
    assert e1.per_task_accuracy == {}

    # Single key should pass
    event_data["per_task_accuracy"] = {"task_A": 0.90}
    e2 = LearningEvent(**event_data)
    assert e2.per_task_accuracy == {"task_A": 0.90}

    # 10 keys should pass
    ten_keys = {f"task_{i}": 0.80 for i in range(10)}
    event_data["per_task_accuracy"] = ten_keys
    e3 = LearningEvent(**event_data)
    assert len(e3.per_task_accuracy) == 10

    # val_accuracy outside [0, 1] raises
    event_data["val_accuracy"] = 1.05
    with pytest.raises(ValidationError):
        LearningEvent(**event_data)
