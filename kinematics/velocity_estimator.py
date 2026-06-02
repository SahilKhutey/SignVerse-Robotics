import numpy as np
from typing import Dict, Any, Optional

class VelocityEstimator:
    """
    Estimates velocities of skeletal joints across consecutive frames.
    """
    def __init__(self, alpha: float = 0.5):
        # Smoothing coefficient for Exponential Moving Average (EMA)
        self.alpha = alpha
        # Store previous positions: {joint_name: np.ndarray}
        self.prev_positions: Dict[str, np.ndarray] = {}
        # Store previous velocities: {joint_name: np.ndarray}
        self.prev_velocities: Dict[str, np.ndarray] = {}

    def estimate(self, joints: Dict[str, Any], dt: float) -> Dict[str, np.ndarray]:
        """
        Estimate velocities for all joints.
        Each joint value can be a dict with 'x','y','z' or a 3-element list/array.
        """
        velocities = {}
        if dt <= 0.0:
            dt = 0.033  # Default fallback dt (30 FPS)
            
        for joint_name, val in joints.items():
            pos = np.array([val["x"], val["y"], val["z"]]) if isinstance(val, dict) else np.array(val)
            
            if joint_name in self.prev_positions:
                prev_pos = self.prev_positions[joint_name]
                # Numeric differentiation
                raw_velocity = (pos - prev_pos) / dt
                
                # Apply smoothing
                if joint_name in self.prev_velocities:
                    smooth_velocity = self.alpha * raw_velocity + (1.0 - self.alpha) * self.prev_velocities[joint_name]
                else:
                    smooth_velocity = raw_velocity
                    
                velocities[joint_name] = smooth_velocity
                self.prev_velocities[joint_name] = smooth_velocity
            else:
                # First frame, zero velocity
                velocities[joint_name] = np.zeros(3)
                self.prev_velocities[joint_name] = np.zeros(3)
                
            self.prev_positions[joint_name] = pos
            
        return velocities
