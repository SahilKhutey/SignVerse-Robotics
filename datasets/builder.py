import os
import json
import numpy as np

def build_dataset(output_dir, dataset_id, metadata, sequences, objects, skills):
    """
    Packages metadata, coordinate sequences, object interactions, and skill tags
    into structured files (JSON and compressed NPZ formats).
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Save metadata index
    index_payload = {
        "dataset_id": dataset_id,
        "metadata": metadata,
        "objects": objects,
        "skills": skills,
        "sequences_count": len(sequences)
    }
    
    json_path = os.path.join(output_dir, f"{dataset_id}_manifest.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(index_payload, f, indent=2)
        
    # 2. Package coordinate sequences into NPZ
    npz_data = {}
    for i, seq in enumerate(sequences):
        seq_id = seq.get("sequence_id", f"seq_{i}")
        frames = seq.get("frames", [])
        
        # Convert frames to numpy float32 array
        frame_arrays = []
        for f in frames:
            joints_data = []
            for joint_name, j_val in f.get("joints", {}).items():
                joints_data.extend([
                    j_val.get("x", 0.0),
                    j_val.get("y", 0.0),
                    j_val.get("z", 0.0),
                    j_val.get("confidence", 0.0)
                ])
            frame_arrays.append(joints_data)
            
        npz_data[seq_id] = np.array(frame_arrays, dtype=np.float32)
        
    npz_path = os.path.join(output_dir, f"{dataset_id}_sequences.npz")
    np.savez_compressed(npz_path, **npz_data)
    
    return {
        "manifest": json_path,
        "archive": npz_path
    }
