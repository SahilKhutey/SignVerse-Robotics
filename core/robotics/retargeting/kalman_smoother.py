"""
LandmarkKalmanSmoother
======================
Applies a lightweight scalar Kalman filter to each spatial dimension of the
MediaPipe landmark array, removing high-frequency measurement noise while
preserving motion dynamics.

Model (constant-velocity):
    State:   x_k = [position, velocity]^T  (2-dim per channel)
    Process: x_{k+1} = F x_k + q   (q ~ N(0, Q))
    Observe: z_k     = H x_k + r   (r ~ N(0, R))

All 99 channels (33 landmarks × 3 axes) are filtered independently in a
single vectorised pass for efficiency.
"""

import numpy as np
from typing import Optional


class LandmarkKalmanSmoother:
    """
    Constant-velocity Kalman filter over MediaPipe body-pose landmarks.

    Parameters
    ----------
    n_landmarks : int
        Number of landmarks per frame.  MediaPipe Holistic body pose uses 33.
    n_dims : int
        Spatial dimensions per landmark (default 3 — x, y, z).
    process_noise : float
        Q — variance of the process-noise (how much motion between frames).
        Higher → trusts measurements more; lower → smoother but laggier.
    measurement_noise : float
        R — variance of sensor / detection noise.
        Higher → trusts the filter prediction more; lower → follows raw data.
    dt : float
        Time-step between frames in seconds (default 1/30 for 30-fps video).
    """

    def __init__(
        self,
        n_landmarks: int = 33,
        n_dims: int = 3,
        process_noise: float = 1e-2,
        measurement_noise: float = 1e-1,
        dt: float = 1.0 / 30.0,
    ):
        self.n_landmarks = n_landmarks
        self.n_dims = n_dims
        self.n_channels = n_landmarks * n_dims  # 99 for standard body pose

        # ── State-transition matrix F (2×2) ──────────────────────────────
        # x_{k+1} = x_k + v_k * dt
        # v_{k+1} = v_k
        self.F = np.array([[1.0, dt], [0.0, 1.0]])  # (2, 2)

        # ── Observation matrix H (1×2) ────────────────────────────────────
        self.H = np.array([[1.0, 0.0]])  # (1, 2)

        # ── Process-noise covariance Q (2×2) ─────────────────────────────
        self.Q = process_noise * np.array(
            [[dt ** 3 / 3, dt ** 2 / 2], [dt ** 2 / 2, dt]]
        )

        # ── Measurement-noise covariance R (scalar) ───────────────────────
        self.R = np.array([[measurement_noise]])

        # ── Per-channel state (n_channels, 2): [position, velocity] ──────
        self._state: Optional[np.ndarray] = None   # (n_channels, 2)
        self._cov: Optional[np.ndarray] = None     # (n_channels, 2, 2)

        self._initialised = False

    # ──────────────────────────────────────────────────────────────────────
    def _init_state(self, first_obs: np.ndarray) -> None:
        """Bootstrap filter state from the very first observation."""
        flat = first_obs.reshape(-1)  # (n_channels,)
        # Initial state: [measured_position, 0_velocity]
        self._state = np.stack([flat, np.zeros_like(flat)], axis=-1)  # (C, 2)
        # Initial covariance: high uncertainty on velocity, low on position
        P0 = np.eye(2)
        P0[1, 1] = 1.0
        self._cov = np.tile(P0[np.newaxis], (self.n_channels, 1, 1))  # (C, 2, 2)
        self._initialised = True

    # ──────────────────────────────────────────────────────────────────────
    def smooth(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Apply one Kalman update step and return the filtered landmarks.

        Parameters
        ----------
        landmarks : np.ndarray, shape (n_landmarks, n_dims) or (n_landmarks, 4)
            Raw landmark array from MediaPipe.  If 4-column (x,y,z,visibility),
            only the first 3 columns are filtered; visibility is passed through.

        Returns
        -------
        np.ndarray, shape matching `landmarks`
        """
        if landmarks is None or landmarks.size == 0:
            return landmarks

        extra_cols: Optional[np.ndarray] = None
        if landmarks.ndim == 2 and landmarks.shape[1] == 4:
            extra_cols = landmarks[:, 3:4]   # preserve visibility column
            xyz = landmarks[:, :3]
        else:
            xyz = landmarks[:, :3] if landmarks.ndim == 2 else landmarks

        obs = xyz.reshape(-1).astype(float)  # (n_channels,)

        if not self._initialised:
            self._init_state(obs)
            out = xyz.copy()
        else:
            # ── Predict ──────────────────────────────────────────────────
            # x_pred = F x  →  shape (C, 2)
            x_pred = (self.F @ self._state[:, :, np.newaxis]).squeeze(-1)

            # P_pred = F P F^T + Q  →  shape (C, 2, 2)
            P_pred = self.F @ self._cov @ self.F.T + self.Q  # broadcast over C

            # ── Update ───────────────────────────────────────────────────
            # Innovation y = z - H x_pred  →  shape (C,)
            # H is (1,2), x_pred is (C,2) — use einsum for clean batched matmul
            H_x = np.einsum("ij,cj->ci", self.H, x_pred)   # (C, 1)
            y = obs - H_x[:, 0]                             # (C,)

            # Innovation covariance S = H P H^T + R  →  (C, 1, 1)
            S = np.einsum("ij,cjk,lk->cil", self.H, P_pred, self.H) + self.R

            # Kalman gain K = P H^T S^{-1}  →  (C, 2, 1)
            PHt = np.einsum("cij,kj->cik", P_pred, self.H)  # (C, 2, 1)
            K = PHt / S                                       # (C, 2, 1)

            # Updated state: x = x_pred + K * y  →  K is (C,2,1), y is (C,)
            # Reshape y to (C,1,1) for broadcast, then squeeze to (C,2)
            self._state = x_pred + (K * y[:, np.newaxis, np.newaxis]).squeeze(-1)

            # Updated covariance: P = (I - K H) P_pred  →  (C, 2, 2)
            # K is (C,2,1), H[np.newaxis] is (1,1,2)  →  matmul gives (C,2,2)
            KH = K @ self.H[np.newaxis]                       # (C, 2, 2)
            I_KH = np.eye(2)[np.newaxis] - KH                 # (C, 2, 2)
            self._cov = I_KH @ P_pred

            # Filtered position is the first component of state
            out = self._state[:, 0].reshape(xyz.shape)

        if extra_cols is not None:
            return np.concatenate([out, extra_cols], axis=-1)
        return out

    def reset(self) -> None:
        """Reset filter state (call between unrelated sequences)."""
        self._state = None
        self._cov = None
        self._initialised = False
