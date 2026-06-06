"""Differential Inverse Kinematics Matrix solvers."""
import numpy as np


def calculate_jacobian(theta_angles, fk_solver=None):
    """Computes the Jacobian matrix J(q) for given joint angles."""
    n = len(theta_angles)
    if fk_solver is None:
        return np.eye(6, n)

    j_pos = np.zeros((3, n), dtype=np.float64)
    theta = np.array(theta_angles, dtype=np.float64)
    p0 = fk_solver.calculate_end_effector(theta)

    delta = 1e-6
    for i in range(n):
        theta_perturbed = theta.copy()
        theta_perturbed[i] += delta
        p_perturbed = fk_solver.calculate_end_effector(theta_perturbed)
        j_pos[:, i] = (p_perturbed - p0) / delta

    j_rot = np.zeros((3, n), dtype=np.float64)
    joint_nodes = fk_solver.get_joint_nodes()
    for i in range(n):
        if i < len(joint_nodes):
            j_rot[:, i] = joint_nodes[i].axis
        else:
            j_rot[:, i] = np.array([0.0, 0.0, 1.0])

    return np.vstack([j_pos, j_rot])

