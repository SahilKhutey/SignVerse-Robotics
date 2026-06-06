import pytest
import os
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app, API_KEY

client = None

@pytest.fixture(scope="module", autouse=True)
def setup_client():
    global client
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    tmp_dir = Path(".tmp_test_artifacts") / f"sim_api_{uuid.uuid4().hex}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = str(tmp_dir / "teleoperation.db")
    with TestClient(app) as c:
        client = c
        yield c
    if previous_db_path is None:
        os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
    else:
        os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

def test_simulation_endpoints_require_auth():
    # POST /api/sim/run should return 403 when no key provided
    response = client.post("/api/sim/run", json={"model_version": "bc_diffusion_v3", "episode_length": 100})
    assert response.status_code == 403

    # GET /api/sim/episodes should return 403 when no key provided
    response = client.get("/api/sim/episodes")
    assert response.status_code == 403

def test_get_episodes_list():
    response = client.get("/api/sim/episodes", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "episodes" in data
    # Baseline episode is pre-seeded
    episodes = data["episodes"]
    assert len(episodes) > 0
    assert episodes[0]["id"] == "sim_baseline_diffusion"

def test_get_episode_frames():
    response = client.get("/api/sim/episode/sim_baseline_diffusion/frames", headers={"X-API-Key": API_KEY})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "frames" in data
    assert len(data["frames"]) == 200
    assert "jointAngles" in data["frames"][0]
    assert len(data["frames"][0]["jointAngles"]) == 7

def test_get_divergence():
    response = client.get(
        "/api/sim/divergence?real_id=session_001&sim_id=sim_baseline_diffusion",
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "report" in data
    report = data["report"]
    assert report["realSessionId"] == "session_001"
    assert report["simEpisodeId"] == "sim_baseline_diffusion"
    assert len(report["perJointRmse"]) == 7
    assert isinstance(report["overallScore"], float)

def test_run_simulation_job():
    # POST to launch simulation
    payload = {
        "model_version": "bc_diffusion_v3",
        "episode_length": 50,
        "real_session_id": "session_001"
    }
    response = client.post("/api/sim/run", headers={"X-API-Key": API_KEY}, json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "started"
    assert "jobId" in data
    
    job_id = data["jobId"]
    
    # Wait briefly for background task simulation loop to generate frames and metrics
    import time
    time.sleep(1.0)
    
    # Verify the episode is registered
    list_response = client.get("/api/sim/episodes", headers={"X-API-Key": API_KEY})
    assert list_response.status_code == 200
    list_data = list_response.json()
    episodes = {e["id"]: e for e in list_data["episodes"]}
    assert job_id in episodes
    
    # Verify we can fetch the completed frames
    frames_response = client.get(f"/api/sim/episode/{job_id}/frames", headers={"X-API-Key": API_KEY})
    assert frames_response.status_code == 200
    frames_data = frames_response.json()
    assert frames_data["status"] == "success"
    assert len(frames_data["frames"]) > 0


def test_generate_synthetic_dataset():
    response = client.post(
        "/api/sim/synthetic",
        headers={"X-API-Key": API_KEY},
        json={"pattern": "wave", "frame_count": 24, "fps": 12, "save": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["pattern"] == "wave"
    assert data["frame_count"] == 24
    assert len(data["frames"]) == 24
    assert len(data["frames"][0]["jointAngles"]) == 7
