"""
Integration Test — WebSockets State Sync Handshake
==================================================
Verifies that the API gateway's `/ws/telemetry` route:
1. Responds with status "FULL_SYNC" when receiving action: "sync" and timestamp 0.0.
2. Correctly replays missed frames with status "REPLAY" for recent timestamps.
3. Automatically falls back to real-time telemetry streaming if no handshake is received within 0.5s.
"""
import sys
import os
import time
import pytest
from fastapi.testclient import TestClient

# Fix path for imports
base_dir = r"c:\Users\User\Documents\SignVerse-Robotics"
sign_verse_robotics_path = os.path.join(base_dir, "sign-verse-robotics")

if base_dir not in sys.path:
    sys.path.insert(0, base_dir)
if sign_verse_robotics_path not in sys.path:
    sys.path.insert(0, sign_verse_robotics_path)

# Merge core paths to prevent import collisions (cached core package)
try:
    import core
    sign_verse_core_path = os.path.join(sign_verse_robotics_path, "core")
    if hasattr(core, "__path__") and sign_verse_core_path not in core.__path__:
        core.__path__.append(sign_verse_core_path)
except ImportError:
    pass

try:
    import importlib
    import types
    core_learning = importlib.import_module("core.learning") if "core.learning" in sys.modules else None
    if core_learning is None:
        # Manually register core.learning as a namespace package
        learning_pkg = types.ModuleType("core.learning")
        sign_verse_learning_path = os.path.join(sign_verse_robotics_path, "core", "learning")
        learning_pkg.__path__ = [sign_verse_learning_path]
        learning_pkg.__package__ = "core.learning"
        sys.modules["core.learning"] = learning_pkg
    else:
        sign_verse_learning_path = os.path.join(sign_verse_robotics_path, "core", "learning")
        if hasattr(core_learning, "__path__") and sign_verse_learning_path not in core_learning.__path__:
            core_learning.__path__.append(sign_verse_learning_path)
except Exception:
    pass

# Also add robotics/edge-runtime to path
edge_runtime_path = os.path.join(base_dir, "robotics", "edge-runtime")
if edge_runtime_path not in sys.path:
    sys.path.insert(0, edge_runtime_path)

from core.deployment.api_gateway.gateway import app

@pytest.fixture(scope="module")
def client():
    """Module-scoped test client to keep the kernel alive across all tests in the module."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def kernel(client):
    """Access the live kernel from gateway state after the client has started the app."""
    from core.deployment.api_gateway import gateway_state
    return gateway_state.get_kernel()

@pytest.fixture(scope="module", autouse=True)
def cleanup_kernel(kernel):
    yield
    kernel.shutdown()

def test_websocket_sync_full_sync(client):
    """Verify that a sync handshake with timestamp 0.0 results in a FULL_SYNC response."""
    with client.websocket_connect("/ws/telemetry") as websocket:
        # Send sync handshake
        websocket.send_json({"action": "sync", "last_received_timestamp": 0.0})
        
        # Read frames until we get the SYNC_RESPONSE
        response = None
        for _ in range(50):
            msg = websocket.receive_json()
            if msg.get("type") == "SYNC_RESPONSE":
                response = msg
                break
        
        assert response is not None
        assert response["type"] == "SYNC_RESPONSE"
        assert response["payload"]["status"] == "FULL_SYNC"
        assert "state" in response["payload"]

def test_websocket_sync_replay(client, kernel):
    """Verify that a sync handshake with a recent timestamp replays the missed frames."""
    # Let's clear and populate some states manually to guarantee a controlled history
    kernel.robot_state.clear()
    
    # Pre-populate state
    kernel.robot_state.update(joints={"J0": 0.1, "J1": 0.2, "J2": 0.3})
    snap1 = kernel.robot_state.get_current_state()
    ts1 = snap1["timestamp"]
    
    # Sleep to ensure timestamp differences
    time.sleep(0.005)
    kernel.robot_state.update(joints={"J0": 0.4, "J1": 0.5, "J2": 0.6})
    
    time.sleep(0.005)
    kernel.robot_state.update(joints={"J0": 0.7, "J1": 0.8, "J2": 0.9})
    
    with client.websocket_connect("/ws/telemetry") as websocket:
        # Request sync since ts1 (should return the subsequent updates)
        websocket.send_json({"action": "sync", "last_received_timestamp": ts1})
        
        # Read frames until we get the SYNC_RESPONSE
        response = None
        for _ in range(50):
            msg = websocket.receive_json()
            if msg.get("type") == "SYNC_RESPONSE":
                response = msg
                break
                
        assert response is not None
        assert response["type"] == "SYNC_RESPONSE"
        assert response["payload"]["status"] == "REPLAY"
        
        frames = response["payload"]["frames"]
        
        # Find our manually pushed frames in the chronological history
        found_1 = False
        found_2 = False
        for f in frames:
            joints = f["joints"]
            if joints.get("J0") == pytest.approx(0.4) and joints.get("J1") == pytest.approx(0.5):
                found_1 = True
            elif joints.get("J0") == pytest.approx(0.7) and joints.get("J1") == pytest.approx(0.8):
                found_2 = True
                assert found_1, "Frames were returned out of chronological order"
                
        assert found_1, "First manual update frame not found in replay history"
        assert found_2, "Second manual update frame not found in replay history"

def test_websocket_handshake_timeout_fallback(client, kernel):
    """Verify that if no handshake is sent within 0.5s, the server falls back to streaming telemetry."""
    # Let's ensure there is some mock telemetry to stream
    kernel.robot_state.update(joints={"J0": 0.0, "J1": 0.0, "J2": 0.0})
    
    with client.websocket_connect("/ws/telemetry") as websocket:
        # Wait without sending anything. Within ~1.5s, we should receive real-time SYSTEM_METRICS.
        start_time = time.time()
        msg = None
        while time.time() - start_time < 2.0:
            try:
                # receive_json is blocking, so we check if it gets the message
                msg = websocket.receive_json()
                if msg:
                    break
            except Exception:
                time.sleep(0.1)
        
        assert msg is not None
        assert msg["type"] == "SYSTEM_METRICS"
        assert "payload" in msg
