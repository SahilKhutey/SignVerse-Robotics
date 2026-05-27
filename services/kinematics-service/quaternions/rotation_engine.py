from scipy.spatial.transform import Rotation
import numpy as np

def euler_to_quaternion(angles_degrees):
    rotation = Rotation.from_euler('xyz', angles_degrees, degrees=True)
    quat = rotation.as_quat()
    return quat.tolist()
