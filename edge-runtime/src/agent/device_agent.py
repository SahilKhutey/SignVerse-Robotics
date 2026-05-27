import time
import threading
from ..telemetry.buffer import TelemetryBuffer
from ..inference.onnx_engine import EdgeInferenceEngine
import uuid

class DeviceAgent:
    def __init__(self, buffer: TelemetryBuffer, inference: EdgeInferenceEngine):
        self.device_id = f"edge_{uuid.uuid4().hex[:8]}"
        self.buffer = buffer
        self.inference = inference
        self.running = False
        self._thread = None

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[DeviceAgent] Started agent {self.device_id}")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join()

    def _run_loop(self):
        while self.running:
            # Simulate sensor read
            telemetry = {
                "device_id": self.device_id,
                "timestamp": time.time(),
                "battery": 88.5,
                "cpu_temp": 45.2
            }
            
            # Local Inference
            import numpy as np
            mock_frame = np.random.rand(1, 3, 224, 224).astype(np.float32)
            inf_result = self.inference.infer(mock_frame)
            telemetry["inference"] = inf_result
            
            # Buffer for cloud sync
            self.buffer.push(telemetry)
            self.buffer.flush() # Try to sync
            
            time.sleep(1) # 1Hz control loop
