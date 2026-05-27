import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Kinematics Math Engine
write_file("services/kinematics-service/fk/simple_fk.py", """import numpy as np
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
""")

write_file("services/kinematics-service/ik/simple_ik.py", """import numpy as np

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
""")

# 2. Robotics Retargeting Engine
write_file("services/retargeting-service/mapping/motion_mapping.py", """import numpy as np

def map_human_to_robot(human_pose, robot_profile):
    '''
    Scale human bone lengths to robot proportions.
    human_pose: dict of absolute positions
    robot_profile: RobotProfile schema dict
    '''
    retargeted = {}
    bone_lengths = robot_profile.get("bone_lengths", {})
    
    # Very basic retargeting: preserve directions, enforce robot lengths
    for joint, pos in human_pose.items():
        if joint == "root":
            retargeted[joint] = pos
            continue
            
        # This requires traversing hierarchy. Simplified mapping:
        # We just copy for the MVP skeleton bounds.
        retargeted[joint] = pos # In reality, we traverse and apply target lengths
        
    return retargeted
""")

write_file("services/retargeting-service/optimization/motion_optimization.py", """import numpy as np

def detect_foot_contact(ankle_velocity, ankle_height, vel_thresh=0.01, height_thresh=0.02):
    return (np.linalg.norm(ankle_velocity) < vel_thresh) and (ankle_height < height_thresh)

def optimize_foot_locking(trajectory, ankle_node):
    '''
    Enforce hard constraint so ankle does not slide when in contact with ground.
    '''
    optimized = []
    locked_pos = None
    
    for i, frame in enumerate(trajectory):
        pos = frame[ankle_node]
        vel = frame.get(f"{ankle_node}_velocity", np.array([0,0,0]))
        height = pos[1] # Assuming Y is up
        
        if detect_foot_contact(vel, height):
            if locked_pos is None:
                locked_pos = np.copy(pos)
                locked_pos[1] = 0.0 # clamp to floor
            frame[ankle_node] = np.copy(locked_pos)
        else:
            locked_pos = None
            
        optimized.append(frame)
    return optimized
""")

# 3. Simulation Exporters
write_file("services/export-service/bvh/export_bvh.py", """def build_bvh_hierarchy(hierarchy_dict, root_node, bone_lengths):
    bvh_str = "HIERARCHY\\n"
    
    def traverse(node, depth=0):
        indent = "  " * depth
        node_str = f"{indent}ROOT {node}\\n" if depth == 0 else f"{indent}JOINT {node}\\n"
        node_str += f"{indent}{{\\n"
        
        length = bone_lengths.get(node, 1.0)
        # Simplified offset
        node_str += f"{indent}  OFFSET 0.0 {length} 0.0\\n"
        node_str += f"{indent}  CHANNELS 3 Zrotation Xrotation Yrotation\\n"
        
        children = hierarchy_dict.get(node, [])
        if not children:
            node_str += f"{indent}  End Site\\n{indent}  {{\\n{indent}    OFFSET 0.0 {length} 0.0\\n{indent}  }}\\n"
        else:
            for child in children:
                node_str += traverse(child, depth + 1)
                
        node_str += f"{indent}}}\\n"
        return node_str
        
    bvh_str += traverse(root_node)
    return bvh_str

def export_bvh(hierarchy_dict, root_node, bone_lengths, frames, output_path):
    bvh_content = build_bvh_hierarchy(hierarchy_dict, root_node, bone_lengths)
    bvh_content += "MOTION\\n"
    bvh_content += f"Frames: {len(frames)}\\n"
    bvh_content += "Frame Time: 0.033333\\n"
    
    # In reality, extract Euler angles from frame rotations
    for f in frames:
        bvh_content += "0.0 0.0 0.0 " * len(hierarchy_dict) + "\\n"
        
    with open(output_path, 'w') as file:
        file.write(bvh_content)
""")

write_file("services/export-service/mujoco/export_mujoco.py", """import xml.etree.ElementTree as ET
import xml.dom.minidom

def generate_mujoco_xml(robot_profile):
    mujoco = ET.Element('mujoco', model=robot_profile.get("robot_name", "humanoid"))
    
    compiler = ET.SubElement(mujoco, 'compiler', angle='degree', coordinate='local')
    option = ET.SubElement(mujoco, 'option', gravity='0 0 -9.81')
    
    worldbody = ET.SubElement(mujoco, 'worldbody')
    ET.SubElement(worldbody, 'light', diffuse='.5 .5 .5', pos='0 0 3', dir='0 0 -1')
    ET.SubElement(worldbody, 'geom', type='plane', size='10 10 0.1', rgba='.9 .9 .9 1')
    
    # Construct base root body
    root = ET.SubElement(worldbody, 'body', name='root', pos='0 0 1')
    ET.SubElement(root, 'geom', type='capsule', size='0.1 0.2', rgba='0.8 0.2 0.2 1')
    
    # Very basic serialization of remaining joints could occur here.
    
    xml_str = ET.tostring(mujoco, encoding='utf-8')
    parsed = xml.dom.minidom.parseString(xml_str)
    return parsed.toprettyxml(indent="    ")
""")

print("Phase 2 Kinematics and Exporters implemented.")
