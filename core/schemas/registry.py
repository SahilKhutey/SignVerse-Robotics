import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from core.schemas.motion import (
    MOTION_SEQUENCE_SCHEMA_VERSION,
    motion_sequence_json_schema,
    validate_motion_sequence,
)


JsonSchemaFactory = Callable[[], dict[str, Any]]
PayloadValidator = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class SchemaDefinition:
    schema_id: str
    title: str
    json_schema_factory: JsonSchemaFactory
    validator: PayloadValidator

    def json_schema(self) -> dict[str, Any]:
        return self.json_schema_factory()

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.validator(payload)

    def summary(self) -> dict[str, str]:
        return {
            "schema_id": self.schema_id,
            "title": self.title,
        }


SCHEMA_REGISTRY: dict[str, SchemaDefinition] = {
    MOTION_SEQUENCE_SCHEMA_VERSION: SchemaDefinition(
        schema_id=MOTION_SEQUENCE_SCHEMA_VERSION,
        title="SignVerse Motion Sequence",
        json_schema_factory=motion_sequence_json_schema,
        validator=validate_motion_sequence,
    )
}


def list_schemas() -> list[dict[str, str]]:
    return [
        definition.summary()
        for _, definition in sorted(SCHEMA_REGISTRY.items(), key=lambda item: item[0])
    ]


def get_schema_definition(schema_id: str) -> SchemaDefinition:
    try:
        return SCHEMA_REGISTRY[schema_id]
    except KeyError as exc:
        raise KeyError(f"Unknown schema_id: {schema_id}") from exc


def get_json_schema(schema_id: str) -> dict[str, Any]:
    return get_schema_definition(schema_id).json_schema()


def validate_payload(payload: dict[str, Any], schema_id: str | None = None) -> dict[str, Any]:
    resolved_schema_id = schema_id or payload.get("schema_version")
    if not isinstance(resolved_schema_id, str):
        raise KeyError("schema_id is required when payload has no schema_version")
    return get_schema_definition(resolved_schema_id).validate(payload)


def export_json_schemas(output_dir: str | Path) -> list[Path]:
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)

    exported_paths: list[Path] = []
    for schema_id, definition in sorted(SCHEMA_REGISTRY.items(), key=lambda item: item[0]):
        output_path = destination / f"{schema_id}.json"
        output_path.write_text(
            json.dumps(definition.json_schema(), indent=2, sort_keys=True),
            encoding="utf-8",
        )
        exported_paths.append(output_path)

    return exported_paths
