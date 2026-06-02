import numpy as np
from typing import List, Tuple, Union
from scipy.spatial.transform import Rotation as R

class QuaternionBuilder:
    """
    Utility class for constructing and manipulating unit quaternions using SciPy.
    Quaternions are represented as [x, y, z, w] in SciPy, but we can also extract [w, x, y, z].
    """
    @staticmethod
    def from_euler(yaw: float, pitch: float, roll: float, seq: str = 'zyx') -> np.ndarray:
        """
        Constructs a quaternion [x, y, z, w] from Euler angles (in radians).
        """
        rot = R.from_euler(seq, [yaw, pitch, roll])
        return rot.as_quat()

    @staticmethod
    def from_matrix(matrix: np.ndarray) -> np.ndarray:
        """
        Constructs a quaternion [x, y, z, w] from a 3x3 rotation matrix.
        """
        rot = R.from_matrix(matrix)
        return rot.as_quat()

    @staticmethod
    def from_two_vectors(v_from: np.ndarray, v_to: np.ndarray) -> np.ndarray:
        """
        Constructs the minimum-rotation quaternion [x, y, z, w] that rotates v_from to align with v_to.
        """
        v_from_norm = v_from / np.linalg.norm(v_from)
        v_to_norm = v_to / np.linalg.norm(v_to)
        
        # Cross product represents rotation axis
        axis = np.cross(v_from_norm, v_to_norm)
        axis_len = np.linalg.norm(axis)
        
        # Dot product represents cos(theta)
        dot_val = np.dot(v_from_norm, v_to_norm)
        
        if axis_len < 1e-6:
            # Parallel or antiparallel vectors
            if dot_val > 0.0:
                # Same direction, identity rotation
                return np.array([0.0, 0.0, 0.0, 1.0])
            else:
                # Opposite direction, 180 degrees rotation around any orthogonal axis
                # Find an orthogonal vector
                orthogonal = np.array([1.0, 0.0, 0.0])
                if abs(v_from_norm[0]) > 0.9:
                    orthogonal = np.array([0.0, 1.0, 0.0])
                axis = np.cross(v_from_norm, orthogonal)
                axis = axis / np.linalg.norm(axis)
                rot = R.from_rotvec(axis * np.pi)
                return rot.as_quat()
                
        # Standard case
        angle = np.arccos(np.clip(dot_val, -1.0, 1.0))
        axis = axis / axis_len
        rot = R.from_rotvec(axis * angle)
        return rot.as_quat()

    @staticmethod
    def slerp(q1: np.ndarray, q2: np.ndarray, t: float) -> np.ndarray:
        """
        Spherical Linear Interpolation (SLERP) between two quaternions.
        """
        key_times = [0.0, 1.0]
        rotations = R.from_quat([q1, q2])
        from scipy.spatial.transform import Slerp
        slerp_obj = Slerp(key_times, rotations)
        interpolated = slerp_obj([t])
        return interpolated.as_quat()[0]
