import pytest
import io
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app, API_KEY

client = None

@pytest.fixture(scope="module", autouse=True)
def setup_client():
    global client
    with TestClient(app) as c:
        client = c
        yield c


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

