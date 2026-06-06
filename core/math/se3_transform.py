"""SE(3) Rigid Body Transformations."""
import numpy as np


class SE3Transform:
    def __init__(self, translation, quaternion):
        self.translation = np.array(translation, dtype=np.float64)
        q = np.array(quaternion, dtype=np.float64)
        norm = np.linalg.norm(q)
        if norm > 1e-9:
            q = q / norm
        else:
            q = np.array([0.0, 0.0, 0.0, 1.0])
        self.quaternion = q

        x, y, z, w = q[0], q[1], q[2], q[3]
        self.R = np.array([
            [1.0 - 2.0 * (y**2 + z**2), 2.0 * (x*y - w*z), 2.0 * (x*z + w*y)],
            [2.0 * (x*y + w*z), 1.0 - 2.0 * (x**2 + z**2), 2.0 * (y*z - w*x)],
            [2.0 * (x*z - w*y), 2.0 * (y*z + w*x), 1.0 - 2.0 * (x**2 + y**2)],
        ], dtype=np.float64)

    def apply(self, point):
        """Apply rigid transformation to a 3D point."""
        return np.dot(self.R, np.array(point, dtype=np.float64)) + self.translation

