import numpy as np

import numpy as np

def map_human_to_robot(human_pose, robot_profile):
    '''
    Scale human bone lengths to robot proportions.
    human_pose: dict of absolute positions
    robot_profile: RobotProfile schema dict
    '''
    retargeted = {}
    bone_lengths = robot_profile.get("bone_lengths", {})
    
    # Define standard skeletal hierarchy connection tree
    hierarchy = {
        "root": ["Joint0"],
        "Joint0": ["Joint1"],
        "Joint1": []
    }
    
    # Retrieve base positions
    root_pos = np.array(human_pose.get("root", [0.0, 0.0, 0.0]), dtype=np.float64)
    retargeted["root"] = root_pos.tolist()
    
    # Recursive retargeting traversal enforcing robot link lengths
    def traverse(parent):
        parent_pos = np.array(retargeted[parent], dtype=np.float64)
        for child in hierarchy.get(parent, []):
            if child in human_pose:
                human_child_pos = np.array(human_pose[child], dtype=np.float64)
                human_parent_pos = np.array(human_pose[parent], dtype=np.float64)
                
                # Compute human bone direction vector
                direction = human_child_pos - human_parent_pos
                dist = np.linalg.norm(direction)
                
                if dist > 1e-5:
                    dir_norm = direction / dist
                else:
                    dir_norm = np.array([0.0, 1.0, 0.0]) # fallback default
                    
                # Enforce robot target bone length
                robot_length = float(bone_lengths.get(child, 1.0))
                child_pos = parent_pos + dir_norm * robot_length
                retargeted[child] = child_pos.tolist()
                
                traverse(child)
                
    traverse("root")
    
    # Fallback to copy other joints if any exist outside standard tree
    for joint, pos in human_pose.items():
        if joint not in retargeted:
            retargeted[joint] = pos
            
    return retargeted
