import numpy as np
from scipy.spatial.transform import Rotation
from typing import Dict, List, Any

class ForwardKinematics:
    def __init__(self, hierarchy: Dict[str, List[str]] = None, bone_lengths: Dict[str, float] = None):
        """
        hierarchy: Dict defining parent -> list of children (e.g. {'root': ['shoulder'], 'shoulder': ['elbow'], 'elbow': ['wrist']})
        bone_lengths: Dict of node name -> length of bone extending from parent
        """
        self.hierarchy = hierarchy or {}
        self.bone_lengths = bone_lengths or {}

    def compute(self, joint_rotations: Dict[str, List[float]], root_pos: np.ndarray = np.array([0.0, 0.0, 0.0])) -> Dict[str, np.ndarray]:
        """
        Computes absolute 3D joint positions using parent rotations and bone offsets.
        joint_rotations: Dict of joint_name -> quaternion rotation [x, y, z, w]
        """
        positions = {"root": root_pos}
        rotations_abs = {"root": Rotation.from_quat(joint_rotations.get("root", [0.0, 0.0, 0.0, 1.0]))}
        
        def traverse(node):
            children = self.hierarchy.get(node, [])
            for child in children:
                # Local rotation of the child joint
                local_rot_quat = joint_rotations.get(child, [0.0, 0.0, 0.0, 1.0])
                local_rot = Rotation.from_quat(local_rot_quat)
                
                # Compound absolute rotation: parent_abs * local_rot
                abs_rot = rotations_abs[node] * local_rot
                rotations_abs[child] = abs_rot
                
                # Assume child extends along Y-axis in joint space
                length = self.bone_lengths.get(child, 1.0)
                offset = abs_rot.apply(np.array([0.0, length, 0.0]))
                
                positions[child] = positions[node] + offset
                traverse(child)
                
        # Start tree traversal from root
        roots = [n for n in self.hierarchy if not any(n in kids for kids in self.hierarchy.values())]
        start_node = roots[0] if roots else "root"
        if start_node not in positions:
            positions[start_node] = root_pos
            rotations_abs[start_node] = Rotation.from_quat(joint_rotations.get(start_node, [0.0, 0.0, 0.0, 1.0]))
            
        traverse(start_node)
        return positions
