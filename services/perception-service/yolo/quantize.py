import os
import onnx
try:
    from onnxruntime.quantization import quantize_dynamic, QuantType
    ORT_QUANT_AVAILABLE = True
except ImportError:
    ORT_QUANT_AVAILABLE = False

class ONNXQuantizer:
    @staticmethod
    def quantize_model(input_model_path, output_model_path):
        """
        Quantizes an ONNX model to dynamic INT8 weights for optimized CPU/GPU execution.
        """
        if not os.path.exists(input_model_path):
            raise FileNotFoundError(f"Input model {input_model_path} not found.")
            
        if not ORT_QUANT_AVAILABLE:
            # If onnxruntime quantization is not installed, copy the original model
            import shutil
            shutil.copyfile(input_model_path, output_model_path)
            print("ONNXRuntime quantization package not available. Copied baseline model.")
            return False
            
        try:
            quantize_dynamic(
                model_input=input_model_path,
                model_output=output_model_path,
                weight_type=QuantType.QUInt8
            )
            print(f"Successfully quantized model to {output_model_path}")
            return True
        except Exception as e:
            print(f"Quantization failed: {e}")
            import shutil
            shutil.copyfile(input_model_path, output_model_path)
            return False
