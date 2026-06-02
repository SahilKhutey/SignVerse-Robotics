import numpy as np
from typing import List, Dict, Any

def compress_motion_sequence(sequence: List[Dict[str, Any]], tolerance: float = 0.01) -> List[Dict[str, Any]]:
    """
    Compresses a motion sequence using keyframe decimation, delta encoding, and quantization.
    Each frame is expected to have structure:
    {"translation": [x,y,z], "joints": {"J0": angle, ...}}
    """
    if len(sequence) < 3:
        # Quantize and return
        quantized = []
        for frame in sequence:
            quantized.append({
                "translation": [round(x, 4) for x in frame["translation"]],
                "joints": {k: round(v, 4) for k, v in frame["joints"].items()},
                "is_keyframe": True
            })
        return quantized

    compressed = []
    # 1. Keyframe Decimation: Keep frame if it is a major change point
    compressed.append(sequence[0])
    
    for i in range(1, len(sequence) - 1):
        prev = sequence[i-1]
        curr = sequence[i]
        nxt = sequence[i+1]
        
        # Check if current frame deviates significantly from linear interpolation between prev and nxt
        deviates = False
        
        # Check translation deviation
        p_t = np.array(prev["translation"])
        c_t = np.array(curr["translation"])
        n_t = np.array(nxt["translation"])
        interpolated_t = 0.5 * (p_t + n_t)
        if np.linalg.norm(c_t - interpolated_t) > tolerance:
            deviates = True
            
        # Check joints deviation
        if not deviates:
            for j_name, c_angle in curr["joints"].items():
                p_angle = prev["joints"].get(j_name, c_angle)
                n_angle = nxt["joints"].get(j_name, c_angle)
                interpolated_j = 0.5 * (p_angle + n_angle)
                if abs(c_angle - interpolated_j) > tolerance:
                    deviates = True
                    break
                    
        if deviates:
            compressed.append(curr)
            
    compressed.append(sequence[-1])
    
    # 2. Delta Encoding and Quantization
    encoded = []
    # Keep first frame absolute, but quantized
    first_frame = {
        "translation": [round(x, 4) for x in compressed[0]["translation"]],
        "joints": {k: round(v, 4) for k, v in compressed[0]["joints"].items()},
        "is_keyframe": True
    }
    encoded.append(first_frame)
    
    for i in range(1, len(compressed)):
        curr = compressed[i]
        prev = compressed[i-1]
        
        # Compute delta
        delta_t = [round(c - p, 4) for c, p in zip(curr["translation"], prev["translation"])]
        delta_j = {}
        for k, v in curr["joints"].items():
            prev_v = prev["joints"].get(k, 0.0)
            delta_j[k] = round(v - prev_v, 4)
            
        encoded.append({
            "delta_translation": delta_t,
            "delta_joints": delta_j,
            "is_keyframe": True
        })
        
    return encoded

def decompress_motion_sequence(compressed_sequence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Decompresses a delta-encoded and keyframe-decimated sequence back to absolute values.
    """
    if not compressed_sequence:
        return []
        
    decompressed = []
    
    # Reconstruct keyframes by accumulating deltas
    curr_t = list(compressed_sequence[0]["translation"])
    curr_j = dict(compressed_sequence[0]["joints"])
    
    decompressed.append({
        "translation": list(curr_t),
        "joints": dict(curr_j)
    })
    
    for i in range(1, len(compressed_sequence)):
        frame = compressed_sequence[i]
        # Accumulate translation deltas
        delta_t = frame["delta_translation"]
        curr_t = [t + dt for t, dt in zip(curr_t, delta_t)]
        
        # Accumulate joint deltas
        delta_j = frame["delta_joints"]
        for k, dj in delta_j.items():
            curr_j[k] = curr_j.get(k, 0.0) + dj
            
        decompressed.append({
            "translation": list(curr_t),
            "joints": dict(curr_j)
        })
        
    return decompressed
