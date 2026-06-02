try:
    import os
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
        dummy_xml = """
        <mujoco>
            <worldbody>
                <geom type="plane" size="10 10 0.1" rgba=".9 .9 .9 1"/>
            </worldbody>
        </mujoco>
        """
        
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
        Maps commanded angles to the actuator ctrl arrays and joint position arrays.
        '''
        if not self.model or not self.data: return
        
        for name, angle in joint_dict.items():
            try:
                # Find joint ID in MuJoCo model
                joint_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_JOINT, name)
                if joint_id != -1:
                    # Get index in qpos array (jnt_qposadr) and write the joint position
                    qpos_adr = self.model.jnt_qposadr[joint_id]
                    self.data.qpos[qpos_adr] = angle
                
                # Also try to map to actuator control if an actuator has this name
                actuator_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_ACTUATOR, name)
                if actuator_id != -1:
                    self.data.ctrl[actuator_id] = angle
            except Exception:
                pass
