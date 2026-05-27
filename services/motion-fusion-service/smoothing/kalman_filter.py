from filterpy.kalman import KalmanFilter
import numpy as np

class JointKalmanFilter:
    def __init__(self):
        self.kf = KalmanFilter(dim_x=4, dim_z=2)
        # State: [x, y, vx, vy]
        self.kf.x = np.array([0., 0., 0., 0.])
        self.kf.F = np.array([[1., 0., 1., 0.],
                              [0., 1., 0., 1.],
                              [0., 0., 1., 0.],
                              [0., 0., 0., 1.]])
        self.kf.H = np.array([[1., 0., 0., 0.],
                              [0., 1., 0., 0.]])
        self.kf.P *= 1000.
        self.kf.R = np.array([[5., 0.],
                              [0., 5.]])
        self.kf.Q = np.eye(4) * 0.1
        self.initialized = False

    def update(self, z):
        if not self.initialized:
            self.kf.x = np.array([z[0], z[1], 0., 0.])
            self.initialized = True
        else:
            self.kf.predict()
            self.kf.update(z)
        return self.kf.x[0], self.kf.x[1]
