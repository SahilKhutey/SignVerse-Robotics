import pytest
import io
import os
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from core.schemas import MOTION_SEQUENCE_SCHEMA_VERSION
from core.deployment.api_gateway.gateway import app, API_KEY

client = None

@pytest.fixture(scope="module", autouse=True)
def setup_client():
    global client
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    previous_disable_fallback = os.environ.get("SIGNVERSE_DISABLE_INGESTION_FALLBACK")
    tmp_dir = Path(".tmp_test_artifacts") / f"api_{uuid.uuid4().hex}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = str(tmp_dir / "teleoperation.db")
    os.environ["SIGNVERSE_DISABLE_INGESTION_FALLBACK"] = "1"
    with TestClient(app) as c:
        client = c
        yield c
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path
    if previous_disable_fallback is None:
        os.environ.pop("SIGNVERSE_DISABLE_INGESTION_FALLBACK", None)
    else:
        os.environ["SIGNVERSE_DISABLE_INGESTION_FALLBACK"] = previous_disable_fallback


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "SignVerse Gateway"
    assert data["kernel"] in {"running", "stopped"}
    assert isinstance(data["ws_clients"], int)
    assert isinstance(data["fps"], (int, float))

def test_command_requires_auth():
    # Should fail with 403 Forbidden because no X-API-Key is provided
    response = client.post("/api/command", json={"command": "move to 90 degrees"})
    assert response.status_code == 403

def test_command_with_invalid_auth():
    response = client.post("/api/command", headers={"X-API-Key": "wrong_key"}, json={"command": "move to 90 degrees"})
    assert response.status_code == 403

def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert b"signverse_commands_total" in response.content
    assert b"signverse_telemetry_mode" in response.content

def test_schema_catalog_requires_auth():
    response = client.get("/api/schemas")
    assert response.status_code == 403

def test_schema_catalog_and_schema_fetch():
    response = client.get("/api/schemas", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert {
        "schema_id": MOTION_SEQUENCE_SCHEMA_VERSION,
        "title": "SignVerse Motion Sequence",
    } in data["schemas"]

    schema_response = client.get(
        f"/api/schemas/{MOTION_SEQUENCE_SCHEMA_VERSION}",
        headers={"X-API-Key": API_KEY},
    )
    assert schema_response.status_code == 200
    schema_data = schema_response.json()
    assert schema_data["schema"]["properties"]["schema_version"]["const"] == MOTION_SEQUENCE_SCHEMA_VERSION

def test_schema_payload_validation_endpoint():
    payload = {
        "sequence_id": "api-sequence",
        "fps": 30,
        "frames": [],
        "metadata": {"source": "api-test"},
    }
    response = client.post(
        f"/api/schemas/{MOTION_SEQUENCE_SCHEMA_VERSION}/validate",
        headers={"X-API-Key": API_KEY},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["payload"]["schema_version"] == MOTION_SEQUENCE_SCHEMA_VERSION
    assert data["payload"]["metadata"]["source"] == "api-test"

    bad_response = client.post(
        f"/api/schemas/{MOTION_SEQUENCE_SCHEMA_VERSION}/validate",
        headers={"X-API-Key": API_KEY},
        json={**payload, "fps": 0},
    )
    assert bad_response.status_code == 422

def test_pipeline_job_lifecycle_endpoint():
    job_id = f"api-pipeline-{uuid.uuid4().hex}"

    create_response = client.post(
        "/api/pipelines",
        headers={"X-API-Key": API_KEY},
        json={
            "job_id": job_id,
            "stages": ["ingestion", "perception"],
            "metadata": {"source": "api-test"},
            "max_retries": 1,
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()["job"]
    assert created["job_id"] == job_id
    assert created["status"] == "queued"
    assert created["current_stage"] == "ingestion"

    start_response = client.post(
        f"/api/pipelines/{job_id}/start",
        headers={"X-API-Key": API_KEY},
        json={"worker_id": "api-worker"},
    )
    assert start_response.status_code == 200
    started = start_response.json()["job"]
    assert started["status"] == "processing"
    assert started["history"][-1]["worker_id"] == "api-worker"

    complete_response = client.post(
        f"/api/pipelines/{job_id}/complete",
        headers={"X-API-Key": API_KEY},
        json={"message": "ingestion done"},
    )
    assert complete_response.status_code == 200
    advanced = complete_response.json()["job"]
    assert advanced["status"] == "queued"
    assert advanced["current_stage"] == "perception"

    invalid_complete = client.post(
        f"/api/pipelines/{job_id}/complete",
        headers={"X-API-Key": API_KEY},
        json={"message": "not processing"},
    )
    assert invalid_complete.status_code == 409

def test_pipeline_job_requires_auth():
    response = client.get("/api/pipelines")
    assert response.status_code == 403

def test_get_processed_datasets():
    response = client.get("/api/datasets/processed", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    names = [ds["name"] for ds in data["datasets"]]
    assert "coffee_pour_kinematics.json" in names
    assert "door_open_trajectory.json" in names

def test_export_dataset():
    response = client.post(
        "/api/datasets/export", 
        headers={"X-API-Key": API_KEY},
        json={"filename": "coffee_pour_kinematics.json", "format": "bvh"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Successfully exported to BVH" in data["message"]
    assert "coffee_pour_kinematics.bvh" in data["file_path"]

def test_youtube_ingestion():
    response = client.post(
        "/api/ingest/youtube",
        headers={"X-API-Key": API_KEY},
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "YouTube URL queued for processing" in data["message"]
    assert "job_id" in data
    assert data["pipeline_job_id"] == data["pipeline_job"]["job_id"]
    assert data["pipeline_job"]["metadata"]["source_type"] == "youtube"
    assert data["pipeline_job"]["metadata"]["queue_job_id"] == data["job_id"]

    pipeline_response = client.get(
        f"/api/pipelines/{data['pipeline_job_id']}",
        headers={"X-API-Key": API_KEY},
    )
    assert pipeline_response.status_code == 200
    assert pipeline_response.json()["job"]["metadata"]["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

def test_image_ingestion():
    file_data = b"dummy image content"
    response = client.post(
        "/api/ingest/image",
        headers={"X-API-Key": API_KEY},
        files={"file": ("dummy_gesture.jpg", io.BytesIO(file_data), "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"] == "dummy_gesture.jpg"
    assert data["pipeline_job_id"] == data["pipeline_job"]["job_id"]
    assert data["pipeline_job"]["metadata"]["source_type"] == "image"
    assert data["pipeline_job"]["metadata"]["filename"] == "dummy_gesture.jpg"
