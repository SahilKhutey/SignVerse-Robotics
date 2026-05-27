import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False

class EdgeInferenceEngine:
    """
    Executes lightweight INT8/FP16 models locally on ARM64 devices (Jetson, RPi)
    to minimize cloud bandwidth and latency.
    """
    def __init__(self, model_path: str = "models/yolov8n-pose.onnx"):
        self.model_path = model_path
        if ONNX_AVAILABLE:
            try:
                # Prioritize TensorRT or CUDA execution providers if available on edge
                self.session = ort.InferenceSession(self.model_path, providers=['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider'])
                self.input_name = self.session.get_inputs()[0].name
                logger.info(f"Loaded ONNX model at edge: {model_path}")
            except Exception as e:
                logger.warning(f"Failed to load ONNX model: {e}")
                self.session = None
        else:
            logger.warning("onnxruntime not installed. Edge inference running in MOCK mode.")

    def predict(self, image_array: np.ndarray) -> dict:
        if ONNX_AVAILABLE and hasattr(self, 'session') and self.session:
            # Expected preprocess: Resize, normalize
            input_tensor = image_array.astype(np.float32) 
            outputs = self.session.run(None, {self.input_name: input_tensor})
            return {"status": "success", "raw_output": outputs}
            
        # Mock edge processing
        return {"status": "mock", "bounding_boxes": [[12, 12, 45, 45]], "latency_ms": 14.2}
