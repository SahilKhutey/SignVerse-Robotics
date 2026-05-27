import json

class MotionReconstructor:
    def __init__(self, env, collision_checker):
        self.env = env
        self.collision_checker = collision_checker
        
    def reconstruct_trajectory(self, kinematics_sequence):
        '''
        Takes a sequence of joint angles and physically plays them out 
        in the MuJoCo environment, verifying simulation feasibility.
        '''
        verified_trajectory = []
        
        for frame in kinematics_sequence:
            joint_angles = frame.get("joint_rotations", {})
            
            # 1. Apply angles to motors
            self.env.apply_joint_angles(joint_angles)
            
            # 2. Step the physics engine forward
            self.env.step_physics()
            
            # 3. Verify feasibility
            if self.collision_checker.check_self_intersection():
                print(f"Collision detected at frame {frame.get('frame_index')}. Marking as Failed.")
                frame["physics_status"] = "FAILED_COLLISION"
            else:
                frame["physics_status"] = "VERIFIED"
                
            verified_trajectory.append(frame)
            
        return verified_trajectory
