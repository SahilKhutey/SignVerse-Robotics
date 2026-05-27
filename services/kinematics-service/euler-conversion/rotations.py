import numpy as np
import math

def euler_to_quaternion(roll, pitch, yaw):
    '''
    Converts XYZ Euler angles to Quaternion [w, x, y, z]
    '''
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)

    w = cr * cp * cy + sr * sp * sy
    x = sr * cp * cy - cr * sp * sy
    y = cr * sp * cy + sr * cp * sy
    z = cr * cp * sy - sr * sp * cy

    return np.array([w, x, y, z])

def clamp_angle(angle, min_limit, max_limit):
    '''
    Safety function to physically prevent robotic hardware damage 
    by restricting angles to anatomical limits.
    '''
    return max(min_limit, min(angle, max_limit))
