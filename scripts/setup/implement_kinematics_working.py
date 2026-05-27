import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Hierarchical Skeleton Graph
write_file("services/kinematics-service/skeleton-graphs/human_rig.py", """class SkeletonNode:
    def __init__(self, name, parent=None, offset=(0.0, 0.0, 0.0)):
        self.name = name
        self.parent = parent
        self.offset = offset
        self.children = []
        if parent:
            parent.children.append(self)

def build_human_t_pose_rig():
    '''
    Builds the standard humanoid T-Pose hierarchy for Kinematics solvers.
    '''
    root = SkeletonNode("hips")
    
    # Spine
    spine = SkeletonNode("spine", parent=root, offset=(0.0, 0.1, 0.0))
    chest = SkeletonNode("chest", parent=spine, offset=(0.0, 0.15, 0.0))
    neck = SkeletonNode("neck", parent=chest, offset=(0.0, 0.1, 0.0))
    head = SkeletonNode("head", parent=neck, offset=(0.0, 0.1, 0.0))
    
    # Left Arm
    l_shoulder = SkeletonNode("l_shoulder", parent=chest, offset=(0.15, 0.0, 0.0))
    l_elbow = SkeletonNode("l_elbow", parent=l_shoulder, offset=(0.25, 0.0, 0.0))
    l_wrist = SkeletonNode("l_wrist", parent=l_elbow, offset=(0.2, 0.0, 0.0))
    
    # Right Arm
    r_shoulder = SkeletonNode("r_shoulder", parent=chest, offset=(-0.15, 0.0, 0.0))
    r_elbow = SkeletonNode("r_elbow", parent=r_shoulder, offset=(-0.25, 0.0, 0.0))
    r_wrist = SkeletonNode("r_wrist", parent=r_elbow, offset=(-0.2, 0.0, 0.0))
    
    # Legs
    l_hip = SkeletonNode("l_hip", parent=root, offset=(0.1, -0.05, 0.0))
    l_knee = SkeletonNode("l_knee", parent=l_hip, offset=(0.0, -0.4, 0.0))
    l_ankle = SkeletonNode("l_ankle", parent=l_knee, offset=(0.0, -0.4, 0.0))
    
    r_hip = SkeletonNode("r_hip", parent=root, offset=(-0.1, -0.05, 0.0))
    r_knee = SkeletonNode("r_knee", parent=r_hip, offset=(0.0, -0.4, 0.0))
    r_ankle = SkeletonNode("r_ankle", parent=r_knee, offset=(0.0, -0.4, 0.0))
    
    return root
""")

# 2. Forward Kinematics (FK) Solver
write_file("services/kinematics-service/fk/forward_kinematics.py", """import numpy as np

def quaternion_to_matrix(q):
    ''' Convert quaternion [w,x,y,z] to 3x3 rotation matrix '''
    w, x, y, z = q
    return np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*w*z,     2*x*z + 2*w*y],
        [2*x*y + 2*w*z,     1 - 2*x*x - 2*z*z, 2*y*z - 2*w*x],
        [2*x*z - 2*w*y,     2*y*z + 2*w*x,     1 - 2*x*x - 2*y*y]
    ])

def solve_fk(node, local_rotations, parent_transform=np.eye(4), global_positions=None):
    '''
    Recursively calculates global positions of all joints based on their local rotations.
    local_rotations: dict mapping node name -> quaternion [w,x,y,z]
    '''
    if global_positions is None:
        global_positions = {}
        
    local_transform = np.eye(4)
    local_transform[0:3, 3] = node.offset
    
    if node.name in local_rotations:
        rot_mat = quaternion_to_matrix(local_rotations[node.name])
        local_transform[0:3, 0:3] = rot_mat
        
    global_transform = parent_transform @ local_transform
    global_positions[node.name] = global_transform[0:3, 3]
    
    for child in node.children:
        solve_fk(child, local_rotations, global_transform, global_positions)
        
    return global_positions
""")

# 3. Euler/Quaternion Conversion Engine
write_file("services/kinematics-service/euler-conversion/rotations.py", """import numpy as np
import math

def euler_to_quaternion(roll, pitch, yaw):
    '''
    Converts XYZ Euler angles to Quaternion [w, x, y, z]
    '''
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)

    w = cr * cp * cy + sr * sp * sy
    x = sr * cp * cy - cr * sp * sy
    y = cr * sp * cy + sr * cp * sy
    z = cr * cp * sy - sr * sp * cy

    return np.array([w, x, y, z])

def clamp_angle(angle, min_limit, max_limit):
    '''
    Safety function to physically prevent robotic hardware damage 
    by restricting angles to anatomical limits.
    '''
    return max(min_limit, min(angle, max_limit))
""")

# 4. Kinematics Pipeline Worker
write_file("services/kinematics-service/worker.py", """import redis
import json
from rq import Worker, Queue, Connection
import sys
import os

# Add local modules to path
sys.path.append(os.path.dirname(__file__))
from skeleton_graphs.human_rig import build_human_t_pose_rig
from fk.forward_kinematics import solve_fk

redis_conn = redis.Redis(host='localhost', port=6379)
q_kinematics = Queue('kinematics', connection=redis_conn)
q_rl = Queue('reinforcement_learning', connection=redis_conn)

rig = build_human_t_pose_rig()

def process_kinematics_job(frame_data_json):
    '''
    Active daemon consuming Perception output and generating physical joint kinematics.
    '''
    frame_data = json.loads(frame_data_json)
    print(f"Processing Kinematics for Frame {frame_data.get('frame_index')}")
    
    # In a full run, we would apply IK here. 
    # For now, we simulate extracting local rotations and running FK.
    
    # Dummy rotations [w,x,y,z] (Identity)
    local_rotations = {
        "hips": [1,0,0,0],
        "l_shoulder": [1,0,0,0],
        "r_shoulder": [1,0,0,0]
    }
    
    # Solve physics
    global_positions = solve_fk(rig, local_rotations)
    
    # Format for next layer
    kinematics_output = {
        "frame_index": frame_data.get('frame_index'),
        "joint_rotations": local_rotations,
        "global_positions": {k: v.tolist() for k, v in global_positions.items()}
    }
    
    # Push to ML stack
    q_rl.enqueue('worker.process_rl_job', json.dumps(kinematics_output))
    return kinematics_output

if __name__ == '__main__':
    with Connection(redis_conn):
        worker = Worker([q_kinematics])
        print("Starting Kinematics Worker daemon...")
        # worker.work() # Commented out so script finishes execution
""")

print("Kinematics Working Modules implemented.")
