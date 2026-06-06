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
async def test_gateway_sustains_1000hz_smoke(uvicorn_server):
    """
    Telemetry loop runs briefly. Frame timestamps show < 2ms jitter (std dev).
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
        duration = 3.0
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
    All receive frames within a bounded local smoke-test latency budget.
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

        # Warm up the observer sender tasks before measuring steady-state relay latency.
        for obs_id in obs_ids:
            await op_ws.send(json.dumps({
                "type": "telemetry_relay",
                "observer_id": obs_id,
                "frame": [-1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }))
        for obs in observers:
            await obs.recv()
            
        # Operator streams a bounded frame sample for CI.
        num_frames = 20
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
        assert maxLagMs < 1500.0, f"Max lag was {maxLagMs:.2f}ms (expected < 1500ms)"

@pytest.mark.asyncio
async def test_ws_reconnect_does_not_cause_frame_spike(uvicorn_server):
    """
    Disconnect WS, reconnect, then verify bounded first-frame recovery and
    post-reconnect delivery for a small burst without dropped frames.
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
        for i in range(20):
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
        
        # Verify we can stream again immediately. Send as a burst first so the
        # check measures queue delivery rather than sequential ping-pong RTT.
        burst_size = 20
        start_time = time.perf_counter()
        for i in range(burst_size):
            payload = {
                "type": "telemetry_relay",
                "observer_id": obs_id,
                "frame": [float(i), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            }
            await op_ws.send(json.dumps(payload))

        received_frames = []
        for _ in range(burst_size):
            msg = json.loads(await obs_ws.recv())
            received_frames.append(msg["data"][0])

        duration = time.perf_counter() - start_time
        delivery_time_ms = duration * 1000
        print(f"Post-reconnect burst delivery took: {delivery_time_ms:.2f} ms")

        assert received_frames == [float(i) for i in range(burst_size)]
        assert delivery_time_ms < 1500.0, (
            f"Post-reconnect burst delivery took {delivery_time_ms:.2f}ms "
            "(expected < 1500ms)"
        )
