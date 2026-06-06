"""Quaternion mathematics for smooth SLERP interpolation."""
import numpy as np


def slerp(q1, q2, t):
    """Spherical linear interpolation between two quaternions [x,y,z,w]."""
    q1 = np.array(q1, dtype=np.float64)
    q2 = np.array(q2, dtype=np.float64)

    norm1 = np.linalg.norm(q1)
    norm2 = np.linalg.norm(q2)
    if norm1 > 1e-9:
        q1 = q1 / norm1
    if norm2 > 1e-9:
        q2 = q2 / norm2

    dot = np.dot(q1, q2)
    if dot < 0.0:
        q2 = -q2
        dot = -dot

    if dot > 0.9995:
        result = q1 + t * (q2 - q1)
        res_norm = np.linalg.norm(result)
        return (result / res_norm) if res_norm > 1e-9 else result

    theta_0 = np.arccos(np.clip(dot, -1.0, 1.0))
    sin_theta_0 = np.sin(theta_0)

    s0 = np.sin((1.0 - t) * theta_0) / sin_theta_0
    s1 = np.sin(t * theta_0) / sin_theta_0

    return s0 * q1 + s1 * q2

