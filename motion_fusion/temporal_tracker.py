import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from scipy.optimize import linear_sum_assignment
from motion_fusion.kalman_filter import JointKalmanFilter

class Track:
    """
    Representation of a single persistent human motion track.
    """
    def __init__(self, track_id: int, bbox: np.ndarray, joints: Optional[Dict[str, np.ndarray]] = None):
        self.track_id = track_id
        # BBox represented as [xmin, ymin, xmax, ymax]
        self.bbox = bbox
        self.joints = joints if joints is not None else {}
        self.age = 1
        self.hits = 1
        self.time_since_update = 0
        
        # Track bbox center velocity using Kalman filter
        self.kf = JointKalmanFilter(process_noise=1e-3, measurement_noise=1e-1)
        center = np.array([
            (bbox[0] + bbox[2]) / 2.0,
            (bbox[1] + bbox[3]) / 2.0,
            0.0
        ])
        self.kf.initialize(center)

    def predict(self, dt: float) -> np.ndarray:
        """
        Predict the track's next bbox center.
        """
        self.time_since_update += 1
        self.age += 1
        return self.kf.predict(dt)

    def update(self, bbox: np.ndarray, joints: Optional[Dict[str, np.ndarray]] = None) -> None:
        """
        Update track variables with new detection.
        """
        self.bbox = bbox
        if joints is not None:
            self.joints = joints
        self.hits += 1
        self.time_since_update = 0
        
        center = np.array([
            (bbox[0] + bbox[2]) / 2.0,
            (bbox[1] + bbox[3]) / 2.0,
            0.0
        ])
        self.kf.update(center)

def compute_iou(box1: np.ndarray, box2: np.ndarray) -> float:
    """
    Computes Intersection-over-Union (IoU) of two bounding boxes.
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    
    if union <= 0.0:
        return 0.0
    return intersection / union

class TemporalTracker:
    """
    Multi-object tracker for persistent identity management.
    """
    def __init__(self, max_lost_frames: int = 30, min_iou: float = 0.3):
        self.tracks: List[Track] = []
        self.next_track_id = 1
        self.max_lost_frames = max_lost_frames
        self.min_iou = min_iou

    def update(self, detections: List[Dict[str, Any]], dt: float = 0.033) -> List[Track]:
        """
        Perform track association with new detections.
        Each detection is a dict containing 'bbox' ([xmin, ymin, xmax, ymax]) and optionally 'joints'.
        """
        # Predict all active tracks
        for track in self.tracks:
            track.predict(dt)
            
        # Match detections to existing tracks
        matched, unmatched_tracks, unmatched_detections = self._associate(detections)
        
        # Update matched tracks
        for track_idx, det_idx in matched:
            det = detections[det_idx]
            self.tracks[track_idx].update(det["bbox"], det.get("joints"))
            
        # Create new tracks for unmatched detections
        for det_idx in unmatched_detections:
            det = detections[det_idx]
            new_track = Track(self.next_track_id, det["bbox"], det.get("joints"))
            self.tracks.append(new_track)
            self.next_track_id += 1
            
        # Clean up lost tracks
        active_tracks = []
        for track in self.tracks:
            if track.time_since_update <= self.max_lost_frames:
                active_tracks.append(track)
        self.tracks = active_tracks
        
        return [t for t in self.tracks if t.time_since_update == 0]

    def _associate(self, detections: List[Dict[str, Any]]) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """
        Associate detections to tracks using linear sum assignment.
        """
        if len(self.tracks) == 0:
            return [], [], list(range(len(detections)))
            
        cost_matrix = np.zeros((len(self.tracks), len(detections)), dtype=np.float32)
        for t_idx, track in enumerate(self.tracks):
            for d_idx, det in enumerate(detections):
                iou_val = compute_iou(track.bbox, det["bbox"])
                cost_matrix[t_idx, d_idx] = 1.0 - iou_val
                
        # Scipy linear sum assignment
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        matched = []
        unmatched_tracks = set(range(len(self.tracks)))
        unmatched_detections = set(range(len(detections)))
        
        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= (1.0 - self.min_iou):
                matched.append((r, c))
                unmatched_tracks.discard(r)
                unmatched_detections.discard(c)
                
        return matched, list(unmatched_tracks), list(unmatched_detections)
