import numpy as np
from scipy.spatial.transform import Rotation

def compute_fk(hierarchy, joint_rotations, bone_lengths, root_pos=np.array([0., 0., 0.])):
    '''
    Compute Forward Kinematics to find absolute positions.
    hierarchy: dict defining parent -> children
    joint_rotations: dict of node -> quaternion [x, y, z, w]
    bone_lengths: dict of node -> length (float)
    '''
    positions = {"root": root_pos}
    rotations_abs = {"root": Rotation.from_quat(joint_rotations.get("root", [0, 0, 0, 1]))}
    
    def traverse(node):
        children = hierarchy.get(node, [])
        for child in children:
            # Local rotation
            local_rot = Rotation.from_quat(joint_rotations.get(child, [0, 0, 0, 1]))
            # Absolute rotation = parent_abs * local
            abs_rot = rotations_abs[node] * local_rot
            rotations_abs[child] = abs_rot
            
            # Assume child extends along Y axis from parent
            length = bone_lengths.get(child, 1.0)
            offset = abs_rot.apply(np.array([0, length, 0]))
            
            positions[child] = positions[node] + offset
            traverse(child)
            
    traverse("root")
    return positions
