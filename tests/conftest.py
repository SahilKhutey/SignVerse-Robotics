import pytest, torch, asyncio
import random
import time
import re
import shutil
from pathlib import Path

_TEMP_ROOT = Path(__file__).resolve().parents[1] / ".pytest_temp"


@pytest.fixture
def tmp_path(request):
    """Workspace-local tmp_path replacement for Windows environments with locked AppData temp dirs."""
    node_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", request.node.nodeid)
    path = _TEMP_ROOT / node_name
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)
    return path

@pytest.fixture
def bc_model():
    """Loads or creates a minimal 7-DOF BC model for testing."""
    from core.bc_model import BCModel
    m = BCModel(input_dim=7*3, output_dim=7, hidden=64)
    return m

@pytest.fixture
def fake_frames():
    from shared_types.telemetry import TelemetryFrame
    import random, time
    return [TelemetryFrame(
        joint_angles=[random.uniform(-3.14, 3.14) for _ in range(7)],
        pose_landmarks=[{"x":0,"y":0,"z":0,"visibility":1}]*33,
        ai_prediction=[0.0]*7,
        confidence=random.random(),
        timestamp_ms=int(time.time()*1000)+i
    ) for i in range(100)]

@pytest.fixture
def replay_buffer(tmp_path):
    from core.replay_buffer import ReplayBuffer
    return ReplayBuffer(capacity=500, persist_path=tmp_path/"rb.pkl")
