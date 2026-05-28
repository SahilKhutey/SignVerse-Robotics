import math
import numpy as np

class EMAFilter:
    """Exponential Moving Average for temporal motion smoothing"""
    def __init__(self, alpha=0.3):
        self.alpha = alpha
        self.state = None

    def update(self, new_value):
        new_val = np.array(new_value)
        if self.state is None:
            self.state = new_val
        else:
            self.state = self.alpha * new_val + (1 - self.alpha) * self.state
        return self.state

class KinematicSolver:
    """
    Core Kinematics Engine.
    Translates normalized human skeletal landmarks into robotic joint constraints.
    """
    def __init__(self):
        # Basic 4-DOF generic robotic arm constraints (Base, Shoulder, Elbow, Wrist)
        self.joint_limits = {
            'base': (-180, 180),
            'shoulder': (-90, 90),
            'elbow': (-150, 0),
            'wrist': (-90, 90)
        }
        
        # Temporal smoothing buffers for each joint
        self.smoothers = {
            'base': EMAFilter(alpha=0.4),
            'shoulder': EMAFilter(alpha=0.4),
            'elbow': EMAFilter(alpha=0.4),
            'wrist': EMAFilter(alpha=0.4)
        }

    def solve_ik_from_pose(self, pose_landmarks):
        """
        Takes raw MediaPipe pose landmarks (list of [x, y, z, visibility]).
        Extracts the right arm and calculates basic FK/IK angles.
        Returns a dictionary of smoothed joint angles in degrees.
        """
        if not pose_landmarks or len(pose_landmarks) < 17:
            return None

        # MediaPipe Landmarks: 12 (Right Shoulder), 14 (Right Elbow), 16 (Right Wrist)
        r_shoulder = np.array(pose_landmarks[12][:3])
        r_elbow = np.array(pose_landmarks[14][:3])
        r_wrist = np.array(pose_landmarks[16][:3])

        # Step 1: Calculate vectors
        upper_arm = r_elbow - r_shoulder
        forearm = r_wrist - r_elbow

        # Step 2: Solve basic analytic angles (Highly simplified for Phase 3 Demo)
        # Assuming Z is depth, X is horizontal, Y is vertical (MediaPipe coordinates are inverted)
        
        # Base rotation (yaw) based on wrist horizontal position relative to shoulder
        base_angle = math.degrees(math.atan2(r_wrist[0] - r_shoulder[0], abs(r_wrist[2] - r_shoulder[2]) + 0.001))
        
        # Shoulder elevation (pitch)
        shoulder_angle = math.degrees(math.atan2(upper_arm[1], abs(upper_arm[2]) + 0.001))
        
        # Elbow flexion (angle between upper arm and forearm)
        dot_product = np.dot(upper_arm, forearm)
        mag_u = np.linalg.norm(upper_arm)
        mag_f = np.linalg.norm(forearm)
        
        cos_angle = max(-1.0, min(1.0, dot_product / ((mag_u * mag_f) + 0.001)))
        elbow_angle = -math.degrees(math.acos(cos_angle)) # Negative because elbows usually bend one way

        # Step 3: Apply Constraints & Smoothing
        angles = {
            'base': self.constrain(base_angle, 'base'),
            'shoulder': self.constrain(shoulder_angle, 'shoulder'),
            'elbow': self.constrain(elbow_angle, 'elbow'),
            'wrist': 0 # Placeholder for wrist rotation
        }

        smoothed_angles = {
            joint: float(self.smoothers[joint].update(angle))
            for joint, angle in angles.items()
        }

        return smoothed_angles

    def constrain(self, value, joint_name):
        min_val, max_val = self.joint_limits[joint_name]
        return max(min_val, min(max_val, value))
