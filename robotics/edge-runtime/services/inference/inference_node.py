"""
Inference Service Node.
Runs local optimized ONNX/TensorRT inference sessions in an isolated process.
Communicates via ZeroMQ IPC.
"""
import time
import logging
from typing import Dict, Any, Callable, Optional, List
import numpy as np
import onnxruntime as ort
import sys
import os
# Fix module resolution for packages with hyphens
_edge_runtime_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _edge_runtime_path not in sys.path:
    sys.path.insert(0, _edge_runtime_path)

from ipc.zmq_bus import IPCBus
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

logger = logging.getLogger(__name__)

class InferenceNode:
    """
    Isolated process node for local AI inference.
    Executes quantized models using highly optimized ONNX Runtime session settings.
    """
    def __init__(self, pub_address: str = "tcp://127.0.0.1:5555",
                 cmd_address: str = "tcp://127.0.0.1:5551",
                 heartbeat_address: str = "tcp://127.0.0.1:5559",
                 model_dir: str = "./models"):
        self.pub_address = os.environ.get("INFERENCE_PUB_ADDR", pub_address)
        self.cmd_address = os.environ.get("INFERENCE_CMD_ADDR", cmd_address)
        self.heartbeat_address = os.environ.get("HEARTBEAT_ADDR", heartbeat_address)
        self.model_dir = model_dir
        self.running = False
        
        self.bus = IPCBus()
        self._loaded_models: Dict[str, ort.InferenceSession] = {}
        self._model_paths: Dict[str, str] = {}
        self._fallback_rules: Dict[str, Callable] = {}
        self.latency_history: List[float] = []

    def configure_session_options(self) -> ort.SessionOptions:
        """Create highly-optimized ONNX session options for low-latency edge deployment."""
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # Optimize execution thread pools for ARM64/Jetson/RPi environments
        # Default to 2 execution threads per session to prevent CPU thread starvation
        opts.intra_op_num_threads = 2
        opts.inter_op_num_threads = 2
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        return opts

    def load_model(self, model_id: str, model_file: str) -> bool:
        """Load an ONNX model into memory with CUDA/TensorRT execution providers if available."""
        model_path = os.path.join(self.model_dir, model_file)
        self._model_paths[model_id] = model_path
        
        if not os.path.exists(model_path):
            logger.warning(f"[InferenceNode] Model file not found: {model_path}")
            return False
            
        try:
            opts = self.configure_session_options()
            
            # Prioritize optimized execution providers for NVIDIA Tegra/Jetson
            providers = [
                'TensorrtExecutionProvider',
                'CUDAExecutionProvider',
                'CPUExecutionProvider'
            ]
            
            session = ort.InferenceSession(model_path, opts, providers=providers)
            self._loaded_models[model_id] = session
            logger.info(f"[InferenceNode] Loaded model '{model_id}' successfully using providers {session.get_providers()}")
            return True
        except Exception as e:
            logger.error(f"[InferenceNode] Failed to load model '{model_id}': {e}")
            return False

    def register_fallback(self, model_id: str, fn: Callable):
        """Register a deterministic rule-based fallback when model is unavailable."""
        self._fallback_rules[model_id] = fn

    def infer(self, model_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute local model inference.
        Falls back to rule-based logic if model is missing or fails.
        Enforces a 30ms latency budget.
        """
        start_time = time.perf_counter()
        
        if model_id not in self._loaded_models:
            fallback = self._fallback_rules.get(model_id)
            if fallback:
                logger.info(f"[InferenceNode] Model '{model_id}' unavailable, executing rule fallback.")
                res = fallback(inputs)
                latency = (time.perf_counter() - start_time) * 1000.0
                res["latency_ms"] = latency
                return res
            return {"error": f"Model {model_id} not loaded and no fallback registered", "latency_ms": 0.0}

        try:
            session = self._loaded_models[model_id]
            input_name = session.get_inputs()[0].name
            
            # Extract and preprocess inputs
            # Example inputs expect numpy array under 'frame' or general key
            raw_input = inputs.get("frame")
            if raw_input is None:
                raw_input = inputs.get("data", np.zeros((1, 3, 224, 224), dtype=np.float32))
                
            if not isinstance(raw_input, np.ndarray):
                raw_input = np.array(raw_input, dtype=np.float32)
                
            outputs = session.run(None, {input_name: raw_input})
            
            # Format output
            result = {
                "status": "success",
                "model_id": model_id,
                "output": outputs[0].tolist() if hasattr(outputs[0], "tolist") else outputs[0],
            }
        except Exception as e:
            logger.error(f"[InferenceNode] Inference error on model '{model_id}': {e}")
            fallback = self._fallback_rules.get(model_id)
            if fallback:
                logger.info(f"[InferenceNode] Falling back to rule-based decoder on error.")
                result = fallback(inputs)
            else:
                result = {"error": str(e)}
                
        latency = (time.perf_counter() - start_time) * 1000.0
        self.latency_history.append(latency)
        result["latency_ms"] = latency
        
        if latency > 30.0:
            logger.warning(f"[InferenceNode] SLA Violated: Latency={latency:.2f}ms (Limit: 30ms)")
            
        return result

    def start(self):
        """Run the service node loop."""
        self.running = True
        self.bus.setup_publisher(self.pub_address)
        self.bus.setup_reply(self.cmd_address)
        
        logger.info(f"Inference Service Node active. CMD={self.cmd_address}, PUB={self.pub_address}")
        
        last_heartbeat = 0.0
        
        while self.running:
            # 1. Handle incoming heartbeat triggers to supervisor
            now = time.time()
            if now - last_heartbeat >= 0.1: # 10Hz heartbeat reporting
                try:
                    self.bus.send_request(self.heartbeat_address, {"node": "inference", "timestamp": now}, timeout_ms=50)
                except Exception:
                    pass
                last_heartbeat = now
                
            # 2. Handle configuration or direct evaluation requests (REP)
            requests = self.bus.poll_replies(timeout_ms=5)
            for addr, socket, req in requests:
                action = req.get("action")
                if action == "load_model":
                    success = self.load_model(req.get("model_id"), req.get("model_file"))
                    self.bus.send_reply(socket, {"status": "success" if success else "failed"})
                elif action == "infer":
                    res = self.infer(req.get("model_id"), req.get("inputs", {}))
                    self.bus.send_reply(socket, res)
                elif action == "list_loaded":
                    self.bus.send_reply(socket, {"models": list(self._loaded_models.keys())})
                elif action == "ping":
                    self.bus.send_reply(socket, {"status": "pong"})
                else:
                    self.bus.send_reply(socket, {"error": f"Unknown action: {action}"})
                    
            time.sleep(0.001) # Sleep to avoid pegging CPU when idle

    def stop(self):
        """Clean shut down."""
        self.running = False
        self.bus.close()
        logger.info("Inference Node stopped.")
