from abc import ABC, abstractmethod
import numpy as np
from typing import Dict, Any, Optional

class PoseProvider(ABC):
    """
    Abstract interface for human pose, face, and hand tracking.
    """
    @abstractmethod
    def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Takes an RGB or BGR numpy array (image frame) and returns a structured
        dictionary containing landmark coordinates.
        
        Expected output format:
        {
            "pose_landmarks": np.ndarray or None,
            "face_landmarks": np.ndarray or None,
            "left_hand_landmarks": np.ndarray or None,
            "right_hand_landmarks": np.ndarray or None
        }
        """
        pass
