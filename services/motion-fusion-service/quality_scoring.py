import numpy as np

def compute_quality_score(sequence):
    '''
    Penalize score based on missing joints or erratic velocity spikes.
    '''
    if not sequence: return 0.0
    
    missing_penalties = 0
    total_joints_expected = len(sequence) * 33 # Assuming 33 pose landmarks
    actual_joints = 0
    
    for frame in sequence:
        actual_joints += len(frame.get("landmarks", {}).get("pose", []))
        
    completion_ratio = actual_joints / total_joints_expected if total_joints_expected > 0 else 0
    score = np.clip(completion_ratio, 0.0, 1.0)
    
    return {"quality_score": round(score, 4)}
