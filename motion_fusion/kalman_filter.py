import numpy as np
from typing import Optional

class JointKalmanFilter:
    """
    Vectorized Kalman Filter for tracking a single joint's 3D position and velocity.
    State representation: [x, y, z, vx, vy, vz]^T
    """
    def __init__(self, process_noise: float = 1e-2, measurement_noise: float = 1e-1, error_cov: float = 1.0):
        # 6D State vector [x, y, z, vx, vy, vz]^T
        self.x = np.zeros(6, dtype=np.float64)
        
        # 6x6 State covariance matrix
        self.P = np.eye(6, dtype=np.float64) * error_cov
        
        # Measurement matrix (3x6) to extract position [x, y, z]
        self.H = np.zeros((3, 6), dtype=np.float64)
        self.H[0, 0] = 1.0
        self.H[1, 1] = 1.0
        self.H[2, 2] = 1.0
        
        # Measurement noise covariance matrix (3x3)
        self.R = np.eye(3, dtype=np.float64) * measurement_noise
        
        # Process noise scaling factor
        self.q_var = process_noise
        
        self.initialized = False

    def initialize(self, position: np.ndarray) -> None:
        """
        Initialize the filter state with the first observed position.
        """
        self.x[:3] = position
        self.x[3:] = 0.0  # Zero initial velocity
        self.initialized = True

    def predict(self, dt: float) -> np.ndarray:
        """
        Predict the next state of the system based on time step dt.
        """
        if not self.initialized:
            return self.x[:3]
            
        # State Transition Matrix F
        F = np.eye(6, dtype=np.float64)
        F[0, 3] = dt
        F[1, 4] = dt
        F[2, 5] = dt
        
        # Process noise covariance matrix Q (discrete white noise model)
        Q = np.zeros((6, 6), dtype=np.float64)
        # Position block
        Q[:3, :3] = np.eye(3) * (self.q_var * (dt ** 3) / 3.0)
        # Cross block
        Q[:3, 3:] = np.eye(3) * (self.q_var * (dt ** 2) / 2.0)
        Q[3:, :3] = np.eye(3) * (self.q_var * (dt ** 2) / 2.0)
        # Velocity block
        Q[3:, 3:] = np.eye(3) * (self.q_var * dt)
        
        # Predict state: x_k = F * x_{k-1}
        self.x = F.dot(self.x)
        
        # Predict covariance: P_k = F * P_{k-1} * F^T + Q
        self.P = F.dot(self.P).dot(F.T) + Q
        
        return self.x[:3]

    def update(self, measurement: np.ndarray) -> np.ndarray:
        """
        Update the state with a new 3D position measurement.
        """
        if not self.initialized:
            self.initialize(measurement)
            return self.x[:3]
            
        # Innovation (residual): y = z - H * x
        y = measurement - self.H.dot(self.x)
        
        # Innovation covariance: S = H * P * H^T + R
        S = self.H.dot(self.P).dot(self.H.T) + self.R
        
        # Kalman Gain: K = P * H^T * S^-1
        K = self.P.dot(self.H.T).dot(np.linalg.inv(S))
        
        # Updated state estimate: x = x + K * y
        self.x = self.x + K.dot(y)
        
        # Updated covariance: P = (I - K * H) * P
        I = np.eye(6, dtype=np.float64)
        self.P = (I - K.dot(self.H)).dot(self.P)
        
        return self.x[:3]

    def get_velocity(self) -> np.ndarray:
        """
        Returns estimated velocity vector [vx, vy, vz].
        """
        return self.x[3:]
