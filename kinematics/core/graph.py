import numpy as np
from typing import Dict, Optional, Tuple
from schemas.svm.v1.skeleton import SkeletonHierarchy, JointEnum
from schemas.svm.v1.motion import JointState, Quaternion, Vector3

class SkeletonGraph:
    """
    Kinematic solver and graph representation for a SkeletonHierarchy.
    """
    def __init__(self, hierarchy: SkeletonHierarchy):
        self.hierarchy = hierarchy
        
    def _quaternion_to_matrix(self, q: Quaternion) -> np.ndarray:
        """
        Converts a Quaternion to a 3x3 rotation matrix.
        """
        w, x, y, z = q.w, q.x, q.y, q.z
        return np.array([
            [1 - 2*y**2 - 2*z**2, 2*x*y - 2*z*w,       2*x*z + 2*y*w],
            [2*x*y + 2*z*w,       1 - 2*x**2 - 2*z**2, 2*y*z - 2*x*w],
            [2*x*z - 2*y*w,       2*y*z + 2*x*w,       1 - 2*x**2 - 2*y**2]
        ])
        
    def forward_kinematics(self, joint_states: Dict[JointEnum, JointState], root_global_pos: Vector3) -> Dict[JointEnum, Vector3]:
        """
        Computes the global positions of all joints given their local rotations and the root position.
        """
        global_positions: Dict[JointEnum, Vector3] = {}
        global_rotations: Dict[JointEnum, np.ndarray] = {}
        
        # Start at root
        root_id = self.hierarchy.root_joint_id
        global_positions[root_id] = root_global_pos
        
        if root_id in joint_states:
            global_rotations[root_id] = self._quaternion_to_matrix(joint_states[root_id].rotation)
        else:
            global_rotations[root_id] = np.eye(3)
            
        # Traverse hierarchy (Assuming we can recursively resolve or sort topologically)
        # For this prototype, we'll use a simple BFS or recursive helper.
        def traverse(current_joint_id: JointEnum):
            children = self.hierarchy.get_children(current_joint_id)
            for child_id in children:
                # Find the bone connecting current to child
                bone = next((b for b in self.hierarchy.bones if b.parent_joint_id == current_joint_id and b.child_joint_id == child_id), None)
                if not bone:
                    continue
                    
                # Assuming the bone is aligned along the local Y axis for this example
                local_offset = np.array([0, bone.length, 0])
                
                # Global pos of child = Global pos of parent + (Global Rot of Parent * local_offset)
                parent_pos = np.array([global_positions[current_joint_id].x, global_positions[current_joint_id].y, global_positions[current_joint_id].z])
                parent_rot = global_rotations[current_joint_id]
                
                child_pos_arr = parent_pos + np.dot(parent_rot, local_offset)
                global_positions[child_id] = Vector3(x=child_pos_arr[0], y=child_pos_arr[1], z=child_pos_arr[2])
                
                # Update child global rotation
                if child_id in joint_states:
                    local_rot = self._quaternion_to_matrix(joint_states[child_id].rotation)
                    global_rotations[child_id] = np.dot(parent_rot, local_rot)
                else:
                    global_rotations[child_id] = parent_rot
                    
                traverse(child_id)
                
        traverse(root_id)
        return global_positions
