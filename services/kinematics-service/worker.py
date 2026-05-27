import redis
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
