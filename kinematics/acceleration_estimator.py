import numpy as np
from typing import Dict, Any, Optional

class AccelerationEstimator:
    """
    Estimates accelerations of skeletal joints from consecutive velocities.
    """
    def __init__(self, alpha: float = 0.5):
        # Smoothing coefficient for Exponential Moving Average (EMA)
        self.alpha = alpha
        # Store previous velocities: {joint_name: np.ndarray}
        self.prev_velocities: Dict[str, np.ndarray] = {}
        # Store previous accelerations: {joint_name: np.ndarray}
        self.prev_accelerations: Dict[str, np.ndarray] = {}

    def estimate(self, velocities: Dict[str, np.ndarray], dt: float) -> Dict[str, np.ndarray]:
        """
        Estimate accelerations for all joints.
        Input velocities is a dictionary mapping joint name to 3D velocity vectors.
        """
        accelerations = {}
        if dt <= 0.0:
            dt = 0.033  # Default fallback dt (30 FPS)
            
        for joint_name, vel in velocities.items():
            vel_arr = np.array(vel)
            
            if joint_name in self.prev_velocities:
                prev_vel = self.prev_velocities[joint_name]
                # Numeric differentiation of velocity
                raw_acceleration = (vel_arr - prev_vel) / dt
                
                # Apply smoothing
                if joint_name in self.prev_accelerations:
                    smooth_acceleration = self.alpha * raw_acceleration + (1.0 - self.alpha) * self.prev_accelerations[joint_name]
                else:
                    smooth_acceleration = raw_acceleration
                    
                accelerations[joint_name] = smooth_acceleration
                self.prev_accelerations[joint_name] = smooth_acceleration
            else:
                # First frame, zero acceleration
                accelerations[joint_name] = np.zeros(3)
                self.prev_accelerations[joint_name] = np.zeros(3)
                
            self.prev_velocities[joint_name] = vel_arr
            
        return accelerations
