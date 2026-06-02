import json
import uuid
from pathlib import Path

import pytest

from core.schemas import (
    MOTION_SEQUENCE_SCHEMA_VERSION,
    export_json_schemas,
    get_json_schema,
    list_schemas,
    validate_payload,
)


def test_schema_registry_lists_and_resolves_motion_schema():
    schemas = list_schemas()
    assert {
        "schema_id": MOTION_SEQUENCE_SCHEMA_VERSION,
        "title": "SignVerse Motion Sequence",
    } in schemas

    schema = get_json_schema(MOTION_SEQUENCE_SCHEMA_VERSION)
    assert schema["$id"].endswith("motion.sequence.v1.json")
    assert schema["properties"]["schema_version"]["const"] == MOTION_SEQUENCE_SCHEMA_VERSION


def test_schema_registry_validates_by_payload_version():
    payload = {
        "schema_version": MOTION_SEQUENCE_SCHEMA_VERSION,
        "sequence_id": "registry-sequence",
        "fps": 30,
        "frames": [],
        "metadata": {"source": "registry-test"},
    }

    validated = validate_payload(payload)
    assert validated["sequence_id"] == "registry-sequence"
    assert validated["metadata"]["source"] == "registry-test"

    with pytest.raises(KeyError, match="Unknown schema_id"):
        validate_payload({**payload, "schema_version": "unknown.v1"})


def test_schema_registry_exports_json_files():
    output_dir = Path(".tmp_test_artifacts") / f"schemas_{uuid.uuid4().hex}"

    paths = export_json_schemas(output_dir)

    assert len(paths) == 1
    assert paths[0].name == f"{MOTION_SEQUENCE_SCHEMA_VERSION}.json"
    exported = json.loads(paths[0].read_text(encoding="utf-8"))
    assert exported["title"] == "SignVerse Motion Sequence"
