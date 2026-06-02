from copy import deepcopy
from math import isfinite
from numbers import Real
from typing import Any

from core.schemas.enums import JointType


MOTION_SEQUENCE_SCHEMA_VERSION = "motion.sequence.v1"


class SchemaValidationError(ValueError):
    pass


def _joint_type_values() -> list[str]:
    return [joint_type.value for joint_type in JointType]


MOTION_SEQUENCE_JSON_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://signverse.dev/schemas/motion.sequence.v1.json",
    "title": "SignVerse Motion Sequence",
    "type": "object",
    "required": ["schema_version", "sequence_id", "fps", "frames", "metadata"],
    "additionalProperties": False,
    "properties": {
        "schema_version": {"const": MOTION_SEQUENCE_SCHEMA_VERSION},
        "sequence_id": {"type": "string", "minLength": 1},
        "fps": {"type": "integer", "minimum": 1},
        "metadata": {"type": "object"},
        "frames": {
            "type": "array",
            "items": {"$ref": "#/$defs/motion_frame"},
        },
    },
    "$defs": {
        "motion_frame": {
            "type": "object",
            "required": ["frame_id", "timestamp", "skeleton"],
            "additionalProperties": False,
            "properties": {
                "frame_id": {"type": "integer", "minimum": 0},
                "timestamp": {"type": "number", "minimum": 0},
                "skeleton": {"$ref": "#/$defs/skeleton_graph"},
            },
        },
        "skeleton_graph": {
            "type": "object",
            "propertyNames": {"enum": _joint_type_values()},
            "additionalProperties": {"$ref": "#/$defs/joint_node"},
        },
        "joint_node": {
            "type": "object",
            "required": ["id", "joint_type", "x", "y", "z", "confidence"],
            "additionalProperties": False,
            "properties": {
                "id": {"type": "integer", "minimum": 0},
                "joint_type": {"enum": _joint_type_values()},
                "x": {"type": "number"},
                "y": {"type": "number"},
                "z": {"type": "number"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            },
        },
    },
}


def motion_sequence_json_schema() -> dict[str, Any]:
    return deepcopy(MOTION_SEQUENCE_JSON_SCHEMA)


def validate_joint_node(payload: dict[str, Any], expected_joint_type: str | None = None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SchemaValidationError("joint node must be an object")

    joint_type = payload.get("joint_type")
    if joint_type not in _joint_type_values():
        raise SchemaValidationError(f"unknown joint_type: {joint_type}")
    if expected_joint_type is not None and joint_type != expected_joint_type:
        raise SchemaValidationError("joint key must match joint_type")

    joint_id = _require_int(payload.get("id"), "id")
    if joint_id < 0:
        raise SchemaValidationError("joint id must be non-negative")

    coordinates = {
        axis: _require_number(payload.get(axis), axis)
        for axis in ("x", "y", "z")
    }
    confidence = _require_number(payload.get("confidence", 1.0), "confidence")
    if not 0.0 <= confidence <= 1.0:
        raise SchemaValidationError("confidence must be between 0.0 and 1.0")

    return {
        "id": joint_id,
        "joint_type": joint_type,
        **coordinates,
        "confidence": confidence,
    }


def validate_skeleton_graph(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if not isinstance(payload, dict):
        raise SchemaValidationError("skeleton must be an object")

    return {
        joint_key: validate_joint_node(joint_payload, expected_joint_type=joint_key)
        for joint_key, joint_payload in payload.items()
    }


def validate_motion_frame(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SchemaValidationError("motion frame must be an object")

    frame_id = _require_int(payload.get("frame_id"), "frame_id")
    if frame_id < 0:
        raise SchemaValidationError("frame_id must be non-negative")

    timestamp = _require_number(payload.get("timestamp"), "timestamp")
    if timestamp < 0:
        raise SchemaValidationError("timestamp must be non-negative")

    return {
        "frame_id": frame_id,
        "timestamp": timestamp,
        "skeleton": validate_skeleton_graph(payload.get("skeleton")),
    }


def validate_motion_sequence(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise SchemaValidationError("motion sequence must be an object")

    schema_version = payload.get("schema_version", MOTION_SEQUENCE_SCHEMA_VERSION)
    if schema_version != MOTION_SEQUENCE_SCHEMA_VERSION:
        raise SchemaValidationError(f"unsupported schema_version: {schema_version}")

    sequence_id = payload.get("sequence_id")
    if not isinstance(sequence_id, str) or not sequence_id:
        raise SchemaValidationError("sequence_id is required")

    fps = _require_int(payload.get("fps", 30), "fps")
    if fps <= 0:
        raise SchemaValidationError("fps must be greater than zero")

    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        raise SchemaValidationError("metadata must be an object")

    frames_payload = payload.get("frames", [])
    if not isinstance(frames_payload, list):
        raise SchemaValidationError("frames must be a list")

    frames = [validate_motion_frame(frame_payload) for frame_payload in frames_payload]
    timestamps = [frame["timestamp"] for frame in frames]
    if timestamps != sorted(timestamps):
        raise SchemaValidationError("MotionFrame timestamps must be monotonic")

    return {
        "schema_version": schema_version,
        "sequence_id": sequence_id,
        "fps": fps,
        "frames": frames,
        "metadata": dict(metadata),
    }


def _require_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise SchemaValidationError(f"{field_name} must be an integer")
    return value


def _require_number(value: Any, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, Real) or not isfinite(float(value)):
        raise SchemaValidationError(f"{field_name} must be a finite number")
    return float(value)
