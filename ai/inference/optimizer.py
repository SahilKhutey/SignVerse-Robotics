"""
SignVerse AI Inference Optimizer — Phase 11
===========================================
Runtime optimization for all AI models deployed in the SignVerse ecosystem.

Covers:
  - INT8/FP16 quantization configuration
  - TensorRT optimization pipeline
  - Dynamic inference batching
  - CUDA multi-stream scheduling
  - Edge ONNX runtime deployment
  - GPU memory management
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional


class PrecisionMode(Enum):
    FP32 = "fp32"    # Full precision — highest accuracy
    FP16 = "fp16"    # Half precision — 2x throughput, minimal accuracy loss
    INT8 = "int8"    # 8-bit integer — 4x throughput, requires calibration
    BF16 = "bf16"    # Brain float — best for transformer models


class InferenceBackend(Enum):
    PYTORCH     = "pytorch"
    TENSORRT    = "tensorrt"
    ONNX        = "onnx"
    ONNX_EDGE   = "onnx_edge"     # Lightweight edge ONNX runtime


@dataclass
class ModelConfig:
    """Configuration for a deployed AI model."""
    model_id: str
    model_path: str
    backend: InferenceBackend
    precision: PrecisionMode
    max_batch_size: int = 8
    input_shapes: dict = field(default_factory=dict)
    output_shapes: dict = field(default_factory=dict)
    warmup_iters: int = 5
    target_latency_ms: float = 50.0    # SLA target
    max_memory_mb: int = 2048


@dataclass
class InferenceRequest:
    """A single batched inference request."""
    request_id: str
    model_id: str
    inputs: dict
    submitted_at: float = field(default_factory=time.time)
    priority: int = 1


@dataclass
class InferenceResult:
    """Result of a completed inference."""
    request_id: str
    model_id: str
    outputs: dict
    latency_ms: float
    batch_size: int
    precision_used: PrecisionMode
    gpu_memory_used_mb: float


class DynamicBatcher:
    """
    Dynamic inference batcher for maximizing GPU utilization.

    Collects individual requests and groups them into optimal batches
    based on latency SLA and queue depth.
    """

    def __init__(self, max_batch_size: int = 8, max_wait_ms: float = 10.0):
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self._queue: list[InferenceRequest] = []
        self._batch_counter = 0

    def enqueue(self, request: InferenceRequest):
        """Add a request to the batching queue."""
        self._queue.append(request)

    def should_flush(self) -> bool:
        """Determine if the batch should be flushed now."""
        if not self._queue:
            return False
        if len(self._queue) >= self.max_batch_size:
            return True
        oldest_age_ms = (time.time() - self._queue[0].submitted_at) * 1000
        return oldest_age_ms >= self.max_wait_ms

    def flush(self) -> list[InferenceRequest]:
        """Extract current batch for processing."""
        batch = self._queue[:self.max_batch_size]
        self._queue = self._queue[self.max_batch_size:]
        self._batch_counter += 1
        return batch

    @property
    def queue_depth(self) -> int:
        return len(self._queue)


class GPUStreamManager:
    """
    CUDA multi-stream manager for parallel GPU execution.

    In production, each stream maps to a CUDA stream for concurrent
    kernel execution without head-of-line blocking.
    """

    def __init__(self, num_streams: int = 4):
        self.num_streams = num_streams
        self._stream_load: dict[int, int] = {i: 0 for i in range(num_streams)}

    def get_least_loaded_stream(self) -> int:
        """Return the stream ID with the lowest current load."""
        return min(self._stream_load, key=self._stream_load.get)

    def mark_stream_busy(self, stream_id: int):
        self._stream_load[stream_id] += 1

    def mark_stream_free(self, stream_id: int):
        self._stream_load[stream_id] = max(0, self._stream_load[stream_id] - 1)

    def utilization_report(self) -> dict:
        total = sum(self._stream_load.values())
        return {
            "total_active": total,
            "streams": dict(self._stream_load),
            "avg_load": total / self.num_streams,
        }


class AIInferenceOptimizer:
    """
    Central AI inference optimization manager.

    Manages:
      - Model loading with precision + backend selection
      - Dynamic batching across concurrent requests
      - CUDA stream scheduling
      - Latency SLA monitoring and alerting
      - GPU memory budget enforcement
    """

    def __init__(self):
        self._models: dict[str, ModelConfig] = {}
        self._batchers: dict[str, DynamicBatcher] = {}
        self._gpu_manager = GPUStreamManager(num_streams=4)
        self._latency_log: dict[str, list[float]] = {}
        self._sla_violation_handlers: list[Callable] = []

    def register_model(self, config: ModelConfig):
        """Register a model configuration for optimized deployment."""
        self._models[config.model_id] = config
        self._batchers[config.model_id] = DynamicBatcher(
            max_batch_size=config.max_batch_size
        )
        self._latency_log[config.model_id] = []
        print(
            f"[AIOptimizer] Registered: {config.model_id} | "
            f"{config.backend.value} | {config.precision.value} | "
            f"max_batch={config.max_batch_size}"
        )

    def submit_request(self, request: InferenceRequest) -> Optional[str]:
        """Submit an inference request to the optimized pipeline."""
        batcher = self._batchers.get(request.model_id)
        if not batcher:
            raise ValueError(f"No registered model: {request.model_id}")
        batcher.enqueue(request)
        return request.request_id

    def process_pending_batches(self, inference_fn: Callable) -> list[InferenceResult]:
        """
        Process all batches that are ready to be flushed.
        
        Args:
            inference_fn: Callable(model_id, batch_inputs, precision) → outputs
        """
        results = []
        for model_id, batcher in self._batchers.items():
            if not batcher.should_flush():
                continue

            batch = batcher.flush()
            config = self._models[model_id]
            stream_id = self._gpu_manager.get_least_loaded_stream()
            self._gpu_manager.mark_stream_busy(stream_id)

            start = time.perf_counter()
            try:
                batch_inputs = {req.request_id: req.inputs for req in batch}
                outputs = inference_fn(model_id, batch_inputs, config.precision)
                latency_ms = (time.perf_counter() - start) * 1000

                self._latency_log[model_id].append(latency_ms)
                if len(self._latency_log[model_id]) > 1000:
                    self._latency_log[model_id] = self._latency_log[model_id][-500:]

                if latency_ms > config.target_latency_ms:
                    for handler in self._sla_violation_handlers:
                        handler(model_id, latency_ms, config.target_latency_ms)

                for req in batch:
                    results.append(InferenceResult(
                        request_id=req.request_id,
                        model_id=model_id,
                        outputs=outputs.get(req.request_id, {}),
                        latency_ms=latency_ms / len(batch),
                        batch_size=len(batch),
                        precision_used=config.precision,
                        gpu_memory_used_mb=0.0,  # Filled by runtime
                    ))
            finally:
                self._gpu_manager.mark_stream_free(stream_id)

        return results

    def on_sla_violation(self, handler: Callable):
        """Register a handler called when inference exceeds the latency SLA."""
        self._sla_violation_handlers.append(handler)

    def get_latency_stats(self, model_id: str) -> dict:
        """Compute latency percentiles for a model."""
        log = sorted(self._latency_log.get(model_id, []))
        if not log:
            return {}
        n = len(log)
        return {
            "p50_ms": log[int(n * 0.50)],
            "p95_ms": log[int(n * 0.95)],
            "p99_ms": log[int(n * 0.99)],
            "max_ms": log[-1],
            "samples": n,
        }

    def gpu_utilization(self) -> dict:
        return self._gpu_manager.utilization_report()


# ─── Quantization Config Generator ───────────────────────────────────────────

def generate_tensorrt_config(
    model_id: str,
    onnx_path: str,
    precision: PrecisionMode,
    calibration_data_path: Optional[str] = None,
) -> dict:
    """
    Generate a TensorRT optimization configuration.
    For INT8 quantization, a calibration dataset path is required.
    """
    config = {
        "model_id": model_id,
        "onnx_path": onnx_path,
        "engine_output_path": f"./engines/{model_id}_{precision.value}.trt",
        "precision": precision.value,
        "workspace_size_mb": 4096,
        "max_batch_size": 8,
        "dynamic_shapes": {
            "min_batch": 1,
            "opt_batch": 4,
            "max_batch": 8,
        },
    }
    if precision == PrecisionMode.INT8:
        if not calibration_data_path:
            raise ValueError("INT8 quantization requires a calibration dataset path")
        config["int8_calibration"] = {
            "method": "entropy",
            "calibration_data": calibration_data_path,
            "cache_file": f"./calibration/{model_id}_int8.cache",
            "num_batches": 100,
        }
    return config
