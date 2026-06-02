import numpy as np
from typing import Dict, Any, Tuple, Optional

class BoneVectorCalculator:
    """
    Computes directional vectors, lengths, and orientations for bone segments in a kinematic chain.
    """
    @staticmethod
    def compute_bone_vector(parent_pos: np.ndarray, child_pos: np.ndarray) -> np.ndarray:
        """
        Computes the vector from parent to child.
        """
        return np.array(child_pos) - np.array(parent_pos)

    @staticmethod
    def compute_bone_length(bone_vector: np.ndarray) -> float:
        """
        Computes the length of a bone vector.
        """
        return float(np.linalg.norm(bone_vector))

    @staticmethod
    def compute_normalized_direction(bone_vector: np.ndarray) -> np.ndarray:
        """
        Returns normalized bone vector direction. Returns zero vector if length is 0.
        """
        length = np.linalg.norm(bone_vector)
        if length < 1e-6:
            return np.zeros_like(bone_vector)
        return bone_vector / length

    @classmethod
    def extract_skeleton_bones(cls, joints: Dict[str, Any], parent_child_links: list) -> Dict[str, Dict[str, Any]]:
        """
        Extracts bone vectors and lengths for all registered links in a skeleton.
        Each joint contains 'x', 'y', 'z' keys.
        """
        bones_data = {}
        for parent, child in parent_child_links:
            if parent in joints and child in joints:
                p_joint = joints[parent]
                c_joint = joints[child]
                
                # Support both dict inputs and array inputs
                p_pos = np.array([p_joint["x"], p_joint["y"], p_joint["z"]]) if isinstance(p_joint, dict) else np.array(p_joint)
                c_pos = np.array([c_joint["x"], c_joint["y"], c_joint["z"]]) if isinstance(c_joint, dict) else np.array(c_joint)
                
                vec = cls.compute_bone_vector(p_pos, c_pos)
                length = cls.compute_bone_length(vec)
                direction = cls.compute_normalized_direction(vec)
                
                bones_data[f"{parent}_to_{child}"] = {
                    "vector": vec.tolist(),
                    "length": length,
                    "direction": direction.tolist()
                }
        return bones_data
