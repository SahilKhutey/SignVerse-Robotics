import mujoco
import numpy as np

class MuJoCoBridge:
    def __init__(self, xml_string):
        """
        Initializes the MuJoCo model and data structures from an XML string.
        """
        try:
            self.model = mujoco.MjModel.from_xml_string(xml_string)
            self.data = mujoco.MjData(self.model)
        except Exception as e:
            print(f"Warning: MuJoCo model failed to load. Error: {e}")
            self.model = None
            self.data = None

    def set_joint_angles(self, qpos_array):
        """
        Updates the physics state with the provided joint angles.
        """
        if self.data is not None:
            # Assumes qpos_array matches the size of model.nq
            if len(qpos_array) == self.model.nq:
                self.data.qpos[:] = qpos_array
                mujoco.mj_forward(self.model, self.data)
                return True
        return False

    def get_end_effector_pos(self, body_name):
        """
        Retrieves the Cartesian position of a named body in the simulation.
        """
        if self.model is not None and self.data is not None:
            body_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_BODY, body_name)
            if body_id >= 0:
                return self.data.xpos[body_id]
        return None
