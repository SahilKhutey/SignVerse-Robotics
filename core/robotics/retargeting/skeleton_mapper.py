"""
MediaPipeSkeletonMapper
=======================
Converts a MediaPipe Holistic body-pose landmark array (33 keypoints, each with
x/y/z in normalised image-space) into a dictionary of unit-length bone vectors
and derived joint angles that are robot-agnostic.

MediaPipe body landmark index reference:
  https://google.github.io/mediapipe/solutions/pose.html#pose-landmark-model

The extracted bone vectors are expressed in the *shoulder-centred* coordinate
frame so that absolute image position does not affect the retargeted output.
"""

import numpy as np
from typing import Dict, Optional, Tuple


# ── MediaPipe body pose landmark indices ──────────────────────────────────────
MP_IDX: Dict[str, int] = {
    "nose":               0,
    "left_eye_inner":     1,
    "left_eye":           2,
    "left_eye_outer":     3,
    "right_eye_inner":    4,
    "right_eye":          5,
    "right_eye_outer":    6,
    "left_ear":           7,
    "right_ear":          8,
    "mouth_left":         9,
    "mouth_right":        10,
    "left_shoulder":      11,
    "right_shoulder":     12,
    "left_elbow":         13,
    "right_elbow":        14,
    "left_wrist":         15,
    "right_wrist":        16,
    "left_pinky":         17,
    "right_pinky":        18,
    "left_index":         19,
    "right_index":        20,
    "left_thumb":         21,
    "right_thumb":        22,
    "left_hip":           23,
    "right_hip":          24,
    "left_knee":          25,
    "right_knee":         26,
    "left_ankle":         27,
    "right_ankle":        28,
    "left_heel":          29,
    "right_heel":         30,
    "left_foot_index":    31,
    "right_foot_index":   32,
}

# ── Bone definitions: (proximal_landmark, distal_landmark) ───────────────────
BONE_DEFINITIONS: Dict[str, Tuple[str, str]] = {
    # Right arm
    "right_upper_arm":   ("right_shoulder", "right_elbow"),
    "right_forearm":     ("right_elbow",    "right_wrist"),
    # Left arm
    "left_upper_arm":    ("left_shoulder",  "left_elbow"),
    "left_forearm":      ("left_elbow",     "left_wrist"),
    # Spine / torso
    "spine":             ("right_hip",      "right_shoulder"),
    "clavicle":          ("left_shoulder",  "right_shoulder"),
    # Right leg
    "right_thigh":       ("right_hip",      "right_knee"),
    "right_shin":        ("right_knee",     "right_ankle"),
    # Left leg
    "left_thigh":        ("left_hip",       "left_knee"),
    "left_shin":         ("left_knee",      "left_ankle"),
}


def _safe_normalise(v: np.ndarray) -> np.ndarray:
    """Return a unit vector; falls back to zero-vector on near-zero norm."""
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros_like(v)


def _angle_between(a: np.ndarray, b: np.ndarray) -> float:
    """
    Angle in radians between two 3-D vectors.
    Result is in [0, π].
    """
    cos_theta = np.clip(np.dot(_safe_normalise(a), _safe_normalise(b)), -1.0, 1.0)
    return float(np.arccos(cos_theta))


class MediaPipeSkeletonMapper:
    """
    Extracts normalised bone vectors and anatomical joint angles from a
    MediaPipe body-pose landmark array.

    Usage
    -----
    mapper = MediaPipeSkeletonMapper()
    result = mapper.extract(landmarks)   # landmarks: np.ndarray (33, 3|4)
    """

    def extract(self, landmarks: np.ndarray) -> Dict:
        """
        Parameters
        ----------
        landmarks : np.ndarray, shape (33, 3) or (33, 4)
            Raw (optionally Kalman-smoothed) MediaPipe body pose landmarks.
            Columns: [x, y, z, (visibility)].

        Returns
        -------
        dict with keys:
            "bone_vectors"  : dict[str, np.ndarray(3,)]  — unit bone directions
            "bone_lengths"  : dict[str, float]           — raw pixel-space lengths
            "joint_angles"  : dict[str, float]           — anatomical angles (radians)
            "shoulder_frame": np.ndarray(3,)             — right-shoulder origin
            "valid"         : bool
        """
        if landmarks is None or landmarks.shape[0] < 33:
            return self._empty_result()

        # Use only xyz, discard visibility
        pts = landmarks[:, :3].astype(float)

        # ── Build shoulder-centred reference frame ────────────────────────
        r_shoulder = pts[MP_IDX["right_shoulder"]]
        l_shoulder = pts[MP_IDX["left_shoulder"]]
        shoulder_mid = (r_shoulder + l_shoulder) / 2.0

        bone_vectors: Dict[str, np.ndarray] = {}
        bone_lengths: Dict[str, float] = {}

        for bone_name, (prox, dist) in BONE_DEFINITIONS.items():
            proximal = pts[MP_IDX[prox]]
            distal   = pts[MP_IDX[dist]]
            raw_vec  = distal - proximal
            bone_lengths[bone_name] = float(np.linalg.norm(raw_vec))
            bone_vectors[bone_name] = _safe_normalise(raw_vec)

        # ── Derive anatomical joint angles ────────────────────────────────
        joint_angles: Dict[str, float] = {}

        # Right shoulder abduction: angle between spine and right_upper_arm
        joint_angles["right_shoulder_abduction"] = _angle_between(
            bone_vectors.get("spine", np.array([0, 1, 0])),
            bone_vectors.get("right_upper_arm", np.zeros(3))
        )

        # Right elbow flexion: angle between upper_arm and forearm vectors
        joint_angles["right_elbow_flexion"] = _angle_between(
            -bone_vectors.get("right_upper_arm", np.zeros(3)),  # reversed: points elbow→shoulder
            bone_vectors.get("right_forearm", np.zeros(3))
        )

        # Left shoulder abduction
        joint_angles["left_shoulder_abduction"] = _angle_between(
            bone_vectors.get("spine", np.array([0, 1, 0])),
            bone_vectors.get("left_upper_arm", np.zeros(3))
        )

        # Left elbow flexion
        joint_angles["left_elbow_flexion"] = _angle_between(
            -bone_vectors.get("left_upper_arm", np.zeros(3)),
            bone_vectors.get("left_forearm", np.zeros(3))
        )

        # Shoulder roll: rotation about the upper-arm axis
        # Approximated by the elevation angle of the forearm in the coronal plane
        joint_angles["right_shoulder_roll"] = self._compute_shoulder_roll(
            pts, side="right"
        )
        joint_angles["left_shoulder_roll"] = self._compute_shoulder_roll(
            pts, side="left"
        )

        # Hip abduction (right)
        joint_angles["right_hip_abduction"] = _angle_between(
            bone_vectors.get("spine", np.array([0, 1, 0])),
            bone_vectors.get("right_thigh", np.zeros(3))
        )

        # Knee flexion (right)
        joint_angles["right_knee_flexion"] = _angle_between(
            -bone_vectors.get("right_thigh", np.zeros(3)),
            bone_vectors.get("right_shin", np.zeros(3))
        )

        return {
            "bone_vectors":   bone_vectors,
            "bone_lengths":   bone_lengths,
            "joint_angles":   joint_angles,
            "shoulder_frame": shoulder_mid,
            "valid":          True,
        }

    # ──────────────────────────────────────────────────────────────────────
    def _compute_shoulder_roll(self, pts: np.ndarray, side: str) -> float:
        """
        Estimates shoulder roll by measuring the out-of-plane angle of the
        forearm relative to the sagittal plane formed by shoulder and hip.
        """
        if side == "right":
            shoulder = pts[MP_IDX["right_shoulder"]]
            elbow    = pts[MP_IDX["right_elbow"]]
            hip      = pts[MP_IDX["right_hip"]]
        else:
            shoulder = pts[MP_IDX["left_shoulder"]]
            elbow    = pts[MP_IDX["left_elbow"]]
            hip      = pts[MP_IDX["left_hip"]]

        # Sagittal reference: shoulder → hip direction
        sagittal = _safe_normalise(hip - shoulder)

        # Upper-arm direction
        upper_arm = _safe_normalise(elbow - shoulder)

        # Normal to the sagittal/upper-arm plane → coronal plane normal
        coronal_n = _safe_normalise(np.cross(sagittal, upper_arm))

        # Roll = elevation from coronal plane (using global Y-up heuristic)
        y_up = np.array([0.0, -1.0, 0.0])  # MediaPipe Y is inverted
        roll = float(np.arctan2(
            np.dot(upper_arm, y_up),
            np.dot(upper_arm, coronal_n)
        ))
        return roll

    @staticmethod
    def _empty_result() -> Dict:
        return {
            "bone_vectors":   {},
            "bone_lengths":   {},
            "joint_angles":   {},
            "shoulder_frame": np.zeros(3),
            "valid":          False,
        }
