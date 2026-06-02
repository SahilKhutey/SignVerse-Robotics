from typing import Any

from fastapi import APIRouter, Body, HTTPException

from core.schemas import (
    SchemaValidationError,
    get_json_schema,
    list_schemas,
    validate_payload,
)


router = APIRouter(prefix="/api/schemas", tags=["Schema Registry"])


@router.get("")
async def get_schema_catalog() -> dict[str, Any]:
    return {"status": "success", "schemas": list_schemas()}


@router.get("/{schema_id}")
async def get_schema(schema_id: str) -> dict[str, Any]:
    try:
        return {
            "status": "success",
            "schema_id": schema_id,
            "schema": get_json_schema(schema_id),
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{schema_id}/validate")
async def validate_schema_payload(
    schema_id: str,
    payload: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    try:
        return {
            "status": "success",
            "schema_id": schema_id,
            "payload": validate_payload(payload, schema_id=schema_id),
        }
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SchemaValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
