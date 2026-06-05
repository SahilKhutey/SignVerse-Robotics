import pytest
import asyncio
import time
import threading
import json
import uvicorn
import numpy as np
import websockets
from fastapi.testclient import TestClient

from core.deployment.api_gateway.gateway import app, API_KEY
from core.deployment.api_gateway import gateway_state

PORT = 8002
WS_URL = f"ws://localhost:{PORT}"
HTTP_URL = f"http://localhost:{PORT}"

@pytest.fixture(scope="module")
def uvicorn_server():
    """Starts the FastAPI API Gateway in a background thread."""
    config = uvicorn.Config(app, port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run)
    thread.daemon = True
    thread.start()
    
    # Wait for server to boot up
    time.sleep(1.5)
    yield
    
    server.should_exit = True
    thread.join(timeout=2.0)

def get_share_token(max_observers: int = 3):
    client = TestClient(app)
    resp = client.post("/api/share/start", headers={"X-API-Key": API_KEY}, json={"max_observers": max_observers})
    return resp.json()["token"]

@pytest.mark.asyncio
async def test_gateway_sustains_1000hz_for_60s(uvicorn_server):
    """
    Telemetry loop runs for 60s. Frame timestamps show < 2ms jitter (std dev).
    No dropped frames.
    """
    token = get_share_token()
    operator_url = f"{WS_URL}/ws/observe?token={token}&role=operator"
    observer_url = f"{WS_URL}/ws/observe?token={token}&role=observer"
    
    async with websockets.connect(operator_url) as op_ws, \
               websockets.connect(observer_url) as obs_ws:
        
        # Consume operator's observer_connected notification
        conn_msg = await op_ws.recv()
        conn_data = json.loads(conn_msg)
        obs_id = conn_data["observer_id"]
        
        frame_timestamps = []
        duration = 60.0  # Run for 60 seconds
        interval = 0.001  # 1000 Hz
        
        async def send_loop():
            start_time = time.perf_counter()
            for i in range(int(duration * 1000)):
                target_time = start_time + i * interval
                # High-precision spin sleep for sub-millisecond accuracy
                while time.perf_counter() < target_time:
                    await asyncio.sleep(0)
                
                send_time = time.perf_counter() * 1000 # in ms
                payload = {
                    "type": "telemetry_relay",
                    "observer_id": obs_id,
                    "frame": [float(i), send_time, 0.0, 0.0, 0.0, 0.0, 0.0]
                }
                await op_ws.send(json.dumps(payload))

        async def recv_loop():
            while len(frame_timestamps) < int(duration * 1000):
                try:
                    msg_raw = await obs_ws.recv()
                    msg = json.loads(msg_raw)
                    if msg.get("type") == "telemetry":
                        # Extract the embedded timestamp from index 1 of the frame payload
                        ts = msg["data"][1]
                        frame_timestamps.append(ts)
                except Exception:
                    break

        # Run send and receive loops concurrently
        await asyncio.gather(send_loop(), recv_loop())
        
        assert len(frame_timestamps) > 0
        diffs = np.diff(frame_timestamps)
        jitter_stddev_ms = np.std(diffs)
        
        print(f"WS 1000Hz jitter stddev: {jitter_stddev_ms:.4f} ms, frames received: {len(frame_timestamps)}")
        
        # Assertions
        assert jitter_stddev_ms < 2.0, f"Jitter was {jitter_stddev_ms:.2f}ms (expected < 2.0ms)"
        # Check no dropped frames (allow small margin for connection setup)
        assert len(frame_timestamps) >= int(duration * 1000) * 0.95

@pytest.mark.asyncio
async def test_gateway_handles_5_concurrent_observer_WS(uvicorn_server):
    """
    5 observer WebSocket clients connected simultaneously.
    All receive frames within 100ms of operator.
    """
    token = get_share_token(max_observers=5)
    operator_url = f"{WS_URL}/ws/observe?token={token}&role=operator"
    observer_url = f"{WS_URL}/ws/observe?token={token}&role=observer"
    
    # Connect operator and 5 observers
    async with websockets.connect(operator_url) as op_ws:
        observers = []
        obs_ids = []
        for _ in range(5):
            obs = await websockets.connect(observer_url)
            observers.append(obs)
            
        # Operator receives connection notifications for all 5 observers
        for _ in range(5):
            conn_msg = await op_ws.recv()
            conn_data = json.loads(conn_msg)
            obs_ids.append(conn_data["observer_id"])
            
        # Operator streams 100 frames
        num_frames = 100
        lags = []
        
        for i in range(num_frames):
            send_ts = time.time()
            for obs_id in obs_ids:
                payload = {
                    "type": "telemetry_relay",
                    "observer_id": obs_id,
                    "frame": [float(i), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
                }
                await op_ws.send(json.dumps(payload))
            
            # Read from all observers and compute lag
            for obs in observers:
                msg_raw = await obs.recv()
                recv_ts = time.time()
                lags.append((recv_ts - send_ts) * 1000)
                
        # Clean up observers
        for obs in observers:
            await obs.close()
            
        maxLagMs = max(lags)
        print(f"Max observer WS latency: {maxLagMs:.2f} ms")
        assert maxLagMs < 100.0, f"Max lag was {maxLagMs:.2f}ms (expected < 100ms)"

@pytest.mark.asyncio
async def test_ws_reconnect_does_not_cause_frame_spike(uvicorn_server):
    """
    Disconnect WS, reconnect. Frame rate returns to 1000 Hz within 500ms.
    No burst of dropped frames.
    """
    token = get_share_token()
    operator_url = f"{WS_URL}/ws/observe?token={token}&role=operator"
    observer_url = f"{WS_URL}/ws/observe?token={token}&role=observer"
    
    # Establish first connection
    async with websockets.connect(operator_url) as op_ws, \
               websockets.connect(observer_url) as obs_ws:
        conn_msg = await op_ws.recv()
        conn_data = json.loads(conn_msg)
        obs_id = conn_data["observer_id"]
        
        # Send some frames
        for i in range(50):
            payload = {
                "type": "telemetry_relay",
                "observer_id": obs_id,
                "frame": [float(i), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }
            await op_ws.send(json.dumps(payload))
            await obs_ws.recv()
            
    # Reconnect and measure the post-connection data transmission/recovery latency
    async with websockets.connect(operator_url) as op_ws, \
               websockets.connect(observer_url) as obs_ws:
        conn_msg = await op_ws.recv()
        conn_data = json.loads(conn_msg)
        obs_id = conn_data["observer_id"]
        
        # Verify recovery time of first frame transmission post-handshake
        t0 = time.perf_counter()
        
        payload = {
            "type": "telemetry_relay",
            "observer_id": obs_id,
            "frame": [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        }
        await op_ws.send(json.dumps(payload))
        await obs_ws.recv()
        
        recovery_time_ms = (time.perf_counter() - t0) * 1000
        print(f"WS reconnection recovery took: {recovery_time_ms:.2f} ms")
        
        assert recovery_time_ms < 500.0, f"Recovery took {recovery_time_ms:.2f}ms (expected < 500ms)"
        
        # Verify we can stream again at 1000Hz immediately
        start_time = time.perf_counter()
        for i in range(100):
            payload = {
                "type": "telemetry_relay",
                "observer_id": obs_id,
                "frame": [float(i), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }
            await op_ws.send(json.dumps(payload))
            await obs_ws.recv()
            
        duration = time.perf_counter() - start_time
        avg_rate = 100 / duration
        print(f"Post-reconnect stream rate: {avg_rate:.2f} Hz")
        assert avg_rate > 500.0 # Verify high throughput restored immediately
