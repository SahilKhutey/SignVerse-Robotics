try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
import numpy as np

class EdgeInferenceEngine:
    def __init__(self, model_path: str = "models/model.onnx"):
        self.session = None
        if ONNX_AVAILABLE:
            try:
                # Fallback to CPU if TensorRT/CUDA unavailable on edge
                self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
                print(f"[EdgeInference] Loaded ONNX model: {model_path}")
            except Exception as e:
                print(f"[EdgeInference] Could not load model (Expected if file missing): {e}")

    def infer(self, input_data: np.ndarray) -> dict:
        if not ONNX_AVAILABLE or not self.session:
            # Mock inference
            return {"status": "mock_inference", "boxes": []}
            
        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        result = self.session.run([output_name], {input_name: input_data})
        return {"status": "success", "data": result[0].tolist()}
