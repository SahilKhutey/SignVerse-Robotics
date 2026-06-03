import time
import pytest
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app

def test_websocket_roundtrip_latency():
    """
    Connect to /ws/telemetry, send 100 ping-pong messages, filter out system broadcasts, 
    and verify RTT is under 20ms.
    """
    client = TestClient(app)
    
    with client.websocket_connect("/ws/telemetry") as websocket:
        latencies = []
        
        # Warmup
        for _ in range(5):
            websocket.send_json({"type": "ping", "ts": time.time()})
            while True:
                resp = websocket.receive_json()
                if resp.get("type") == "PONG":
                    break
            
        for _ in range(100):
            t0 = time.perf_counter()
            websocket.send_json({"type": "ping", "ts": time.time()})
            while True:
                resp = websocket.receive_json()
                if resp.get("type") == "PONG":
                    break
            t1 = time.perf_counter()
            
            latencies.append((t1 - t0) * 1000.0) # in ms
            
        avg_latency = sum(latencies) / len(latencies)
        print(f"\nAverage WebSocket round-trip latency: {avg_latency:.3f} ms")
        print(f"Max WebSocket latency: {max(latencies):.3f} ms")
        print(f"Min WebSocket latency: {min(latencies):.3f} ms")
        
        # Latency must be < 20ms
        assert avg_latency < 20.0, f"Latency gate failed: Average RTT is {avg_latency:.2f} ms (expected < 20 ms)"
