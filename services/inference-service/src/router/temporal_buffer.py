import numpy as np
import logging
from collections import deque

logger = logging.getLogger(__name__)

class TemporalBuffer:
    """
    Maintains a rolling window of frames/embeddings for temporal sequence models (LSTMs/Transformers).
    Critical for sign language which is time-series dependent.
    """
    def __init__(self, max_frames=30, feature_dim=512):
        self.max_frames = max_frames
        self.feature_dim = feature_dim
        self.buffer = deque(maxlen=max_frames)

    def add_frame_features(self, features: np.ndarray):
        if features.shape[-1] != self.feature_dim:
            raise ValueError("Feature dimension mismatch")
        self.buffer.append(features)

    def get_sequence_tensor(self) -> np.ndarray:
        """Returns padded temporal sequence [SeqLen, FeatureDim]"""
        seq = list(self.buffer)
        if len(seq) == 0:
            return np.zeros((self.max_frames, self.feature_dim))
            
        # Pad if sequence is shorter than max_frames
        if len(seq) < self.max_frames:
            padding = [np.zeros_like(seq[0])] * (self.max_frames - len(seq))
            seq.extend(padding)
            
        return np.stack(seq)
