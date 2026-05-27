import numpy as np

def solve_ik_ccd(chain_points, target_position, max_iterations=10, tolerance=1e-3):
    '''
    Cyclic Coordinate Descent (CCD) IK solver.
    chain_points: List of np.array points, from root to end-effector.
    '''
    points = [np.copy(p) for p in chain_points]
    end_effector_idx = len(points) - 1
    
    for _ in range(max_iterations):
        if np.linalg.norm(points[end_effector_idx] - target_position) < tolerance:
            break
            
        for i in range(end_effector_idx - 1, -1, -1):
            root = points[i]
            cur_end = points[end_effector_idx]
            
            dir_to_target = target_position - root
            dir_to_end = cur_end - root
            
            # Normalize
            len_target = np.linalg.norm(dir_to_target)
            len_end = np.linalg.norm(dir_to_end)
            
            if len_target < 1e-5 or len_end < 1e-5:
                continue
                
            dir_to_target /= len_target
            dir_to_end /= len_end
            
            dot = np.clip(np.dot(dir_to_end, dir_to_target), -1.0, 1.0)
            angle = np.arccos(dot)
            
            if abs(angle) < 1e-5:
                continue
                
            axis = np.cross(dir_to_end, dir_to_target)
            axis_len = np.linalg.norm(axis)
            if axis_len < 1e-5:
                continue
            axis /= axis_len
            
            import math
            from scipy.spatial.transform import Rotation
            rot = Rotation.from_rotvec(axis * angle)
            
            for j in range(i + 1, len(points)):
                points[j] = root + rot.apply(points[j] - root)
                
    return points
