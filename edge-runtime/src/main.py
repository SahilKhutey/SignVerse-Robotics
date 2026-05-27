import time
import threading
from .agent.device_agent import DeviceAgent
from .inference.onnx_engine import EdgeInferenceEngine
from .telemetry.buffer import TelemetryBuffer

def main():
    print("[EdgeRuntime] Booting SignVerse Edge Kernel...")
    
    buffer = TelemetryBuffer()
    inference = EdgeInferenceEngine()
    agent = DeviceAgent(buffer, inference)
    
    agent.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("[EdgeRuntime] Shutting down...")
        agent.stop()

if __name__ == "__main__":
    main()
