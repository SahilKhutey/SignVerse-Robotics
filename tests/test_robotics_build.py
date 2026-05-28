import numpy as np
import pytest
from core.robotics.kinematics.inverse_kinematics import InverseKinematicsSolver
from core.robotics.simulation.mujoco_exporter import MuJoCoBridge

def test_inverse_kinematics():
    # Define a simple 2D arm forward kinematics
    # L1 = 1.0, L2 = 1.0
    def simple_arm_fk(q):
        x = np.cos(q[0]) + np.cos(q[0] + q[1])
        y = np.sin(q[0]) + np.sin(q[0] + q[1])
        z = 0.0
        return np.array([x, y, z])

    solver = InverseKinematicsSolver(simple_arm_fk)
    
    # Target: Fully extended along X axis (x=2.0, y=0.0) -> requires q=[0, 0]
    target = np.array([2.0, 0.0, 0.0])
    initial_q = np.array([0.5, 0.5])
    
    result = solver.solve(initial_q, target)
    
    assert result["converged"] is True
    assert result["error"] < 1e-3
    
    # Final position should match target
    final_pos = simple_arm_fk(result["q"])
    assert np.linalg.norm(final_pos - target) < 1e-3

def test_mujoco_bridge():
    # Simple XML defining a single revolute joint attached to a body
    xml = """
    <mujoco>
      <worldbody>
        <body>
          <joint name="hinge" type="hinge" axis="0 0 1"/>
          <geom type="capsule" size="0.1 0.5"/>
        </body>
      </worldbody>
    </mujoco>
    """
    bridge = MuJoCoBridge(xml)
    
    # Assert model loaded successfully
    assert bridge.model is not None
    assert bridge.model.nq == 1
    
    # Update joint angle
    success = bridge.set_joint_angles(np.array([1.57]))
    assert success is True
    
    # Verify the qpos was actually set in the physics data
    assert np.isclose(bridge.data.qpos[0], 1.57)

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_robotics_build.py"])
