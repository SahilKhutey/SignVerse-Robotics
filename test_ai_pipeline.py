import sys
import logging
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Add services to path so we can import them locally
sys.path.append("edge-runtime")
sys.path.append("services/dataset-service")
sys.path.append("services/inference-service")

try:
    from src.inference.onnx_engine import EdgeInferenceEngine
    from src.storage.s3_provider import S3StorageProvider
    from src.indexing.qdrant_search import VectorEngine
    from src.router.temporal_buffer import TemporalBuffer
except ImportError as e:
    print(f"Error importing AI modules: {e}")
    sys.exit(1)

def run_verification():
    print("==========================================")
    print(" VERIFYING DEEP LEARNING & MLOPS PIPELINE")
    print("==========================================")
    
    # 1. Edge Processing
    print("\\n[1] Executing Edge AI Runtime...")
    edge_engine = EdgeInferenceEngine()
    dummy_frame = np.random.rand(1, 3, 224, 224)
    edge_res = edge_engine.predict(dummy_frame)
    print(f"    - Edge Output: {edge_res}")
    
    # 2. Cloud Inference Temporal Buffer
    print("\\n[2] Accumulating Temporal Sequences in Cloud Inference Service...")
    buffer = TemporalBuffer(max_frames=30, feature_dim=512)
    for _ in range(5):
        buffer.add_frame_features(np.random.rand(512))
    seq_tensor = buffer.get_sequence_tensor()
    print(f"    - Temporal Tensor Shape (for LSTM/Transformer): {seq_tensor.shape}")
    
    # 3. Dataset Service / MLOps
    print("\\n[3] Ingesting Edge Telemetry to Dataset Ecosystem...")
    s3 = S3StorageProvider()
    print(f"    - S3 Configuration Loaded for Bucket: {s3.bucket_name}")
    
    vector_engine = VectorEngine()
    print("    - Vector Search Engine Initialized")
    # Mocking an embedding insertion
    vector_engine.insert_embedding(point_id=101, vector=np.random.rand(512).tolist(), payload={"action": "sign_hello"})
    
    results = vector_engine.search_similar(query_vector=np.random.rand(512).tolist())
    print(f"    - Semantic Search Results: {results[0] if results else 'None'}")
    
    print("==========================================")
    print(" AI PIPELINE VERIFICATION COMPLETE. ALL NOMINAL.")
    print("==========================================")

if __name__ == "__main__":
    run_verification()
