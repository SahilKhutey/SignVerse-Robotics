import numpy as np
from typing import Dict, Tuple

class JointAngleCalculator:
    """
    Computes joint angles and rotational vectors between bone segments.
    """
    @staticmethod
    def compute_angle_between_vectors(v1: np.ndarray, v2: np.ndarray) -> float:
        """
        Computes the angle in radians between two 3D vectors.
        """
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 < 1e-6 or norm_v2 < 1e-6:
            return 0.0
            
        cos_theta = np.dot(v1, v2) / (norm_v1 * norm_v2)
        cos_theta = np.clip(cos_theta, -1.0, 1.0)
        return float(np.arccos(cos_theta))

    @staticmethod
    def compute_euler_angles(v: np.ndarray) -> Tuple[float, float, float]:
        """
        Computes Euler-like rotation angles (yaw, pitch, roll) of a single bone vector
        relative to the canonical coordinate axes.
        """
        x, y, z = v[0], v[1], v[2]
        length = np.linalg.norm(v)
        if length < 1e-6:
            return 0.0, 0.0, 0.0
            
        # Pitch: rotation around X axis (elevation)
        pitch = float(np.arcsin(np.clip(y / length, -1.0, 1.0)))
        
        # Yaw: rotation around Y axis (azimuth)
        yaw = float(np.arctan2(x, z))
        
        # Roll: rotation around Z axis (assumed 0 here as standard vector has no twist)
        roll = 0.0
        
        return yaw, pitch, roll

    @classmethod
    def compute_all_joint_angles(cls, bones_data: Dict[str, Dict[str, Any]], hierarchy: dict) -> Dict[str, float]:
        """
        Computes relative hinge angles for joints where parent and child bones connect.
        """
        angles = {}
        for parent, children in hierarchy.items():
            for child in children:
                # If there are sub-children, we can compute angle between parent_to_child and child_to_subchild
                for subchild in hierarchy.get(child, []):
                    bone1_key = f"{parent}_to_{child}"
                    bone2_key = f"{child}_to_{subchild}"
                    
                    if bone1_key in bones_data and bone2_key in bones_data:
                        v1 = np.array(bones_data[bone1_key]["vector"])
                        v2 = np.array(bones_data[bone2_key]["vector"])
                        angle = cls.compute_angle_between_vectors(v1, v2)
                        angles[child] = angle
        return angles
