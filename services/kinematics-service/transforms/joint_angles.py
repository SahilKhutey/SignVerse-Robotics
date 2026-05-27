import numpy as np

def angle_between(v1, v2):
    unit_v1 = v1 / np.linalg.norm(v1)
    unit_v2 = v2 / np.linalg.norm(v2)
    dot = np.dot(unit_v1, unit_v2)
    # Clip to avoid float precision issues with arccos
    dot = np.clip(dot, -1.0, 1.0)
    angle = np.arccos(dot)
    return np.degrees(angle)
