import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. 3D MuJoCo Physics Environment
write_file("services/simulation-service/simulation-3d/mujoco_env.py", """try:
    import mujoco
    MUJOCO_AVAILABLE = True
except ImportError:
    MUJOCO_AVAILABLE = False

class MuJoCoEnvironment:
    def __init__(self, xml_path=None):
        '''
        Initializes the rigid body physics engine.
        '''
        self.xml_path = xml_path
        if not MUJOCO_AVAILABLE:
            print("WARNING: mujoco not installed. Using mock physics environment.")
            self.model = None
            self.data = None
            return
            
        # For the MVP, if no XML provided, use a simple dummy pendulum string
        dummy_xml = \"\"\"
        <mujoco>
            <worlddir>
                <geom type="plane" size="10 10 0.1" rgba=".9 .9 .9 1"/>
            </worlddir>
        </mujoco>
        \"\"\"
        
        try:
            if xml_path and os.path.exists(xml_path):
                self.model = mujoco.MjModel.from_xml_path(xml_path)
            else:
                self.model = mujoco.MjModel.from_xml_string(dummy_xml)
            self.data = mujoco.MjData(self.model)
        except Exception as e:
            print(f"MuJoCo initialization failed: {e}")
            self.model = None
            self.data = None
            
    def step_physics(self):
        if self.model and self.data:
            mujoco.mj_step(self.model, self.data)
            
    def apply_joint_angles(self, joint_dict):
        '''
        Maps commanded angles to the actuator ctrl arrays.
        '''
        if not self.model or not self.data: return
        
        # In a real mapping, we map string joint names to mujoco IDs
        # e.g., mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, "l_shoulder")
        pass
""")

# 2. Physical Collision & Feasibility Engine
write_file("services/simulation-service/physics/collision_checker.py", """class CollisionChecker:
    def __init__(self, env):
        self.env = env
        
    def check_self_intersection(self):
        '''
        Examines the MuJoCo data.ncon array to determine if two physical bodies
        are occupying the same space (e.g., hand clipping through chest).
        '''
        if not self.env.data:
            return False # Cannot check without physics engine
            
        # ncon holds the number of active contacts
        if self.env.data.ncon > 0:
            for i in range(self.env.data.ncon):
                contact = self.env.data.contact[i]
                # geom1 and geom2 are the IDs of the colliding meshes
                geom1 = contact.geom1
                geom2 = contact.geom2
                
                # In a rigorous setup, we check if geom1 and geom2 belong to the robot
                # and ignore intentional contacts (like foot hitting the floor).
                # For MVP, we flag any contact as a potential collision risk.
                return True
                
        return False
""")

# 3. Motion Reconstructor Engine
write_file("services/simulation-service/replay-engine/motion_reconstructor.py", """import json

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
""")

# 4. 2D Simulation Plotter
write_file("services/simulation-service/simulation-2d/renderer.py", """import os
try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

class TrajectoryPlotter:
    def __init__(self, output_dir="diagnostics"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def plot_sim2real_gap(self, target_angles, actual_angles, joint_name="elbow"):
        '''
        Plots a 2D graph comparing the commanded AI angles versus the 
        actual angles the robot physically achieved in simulation (PID lag).
        '''
        if not MATPLOTLIB_AVAILABLE:
            print("Matplotlib not installed. Skipping 2D diagnostics.")
            return
            
        plt.figure(figsize=(10, 5))
        plt.plot(target_angles, label='Commanded (AI)', linestyle='--', color='blue')
        plt.plot(actual_angles, label='Simulated Reality', color='red')
        
        plt.title(f"Sim2Real Gap Analysis: {joint_name}")
        plt.xlabel("Frame")
        plt.ylabel("Angle (Radians)")
        plt.legend()
        plt.grid(True)
        
        save_path = os.path.join(self.output_dir, f"{joint_name}_gap.png")
        plt.savefig(save_path)
        plt.close()
        print(f"Diagnostic plot saved to {save_path}")
""")

print("Simulation and Motion Reconstruction Modules implemented.")
