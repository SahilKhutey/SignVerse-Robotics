import numpy as np
from typing import Dict, Any, List, Optional
from motion_fusion.temporal_tracker import compute_iou, Track

class IdentityManager:
    """
    Manages active/inactive track states and tracks ID persistence/redundancy.
    """
    def __init__(self, merge_iou_threshold: float = 0.8, history_limit: int = 100):
        self.merge_iou_threshold = merge_iou_threshold
        self.history_limit = history_limit
        # Map track_id -> historical sequence of centroids/skeletons
        self.profiles: Dict[int, Dict[str, Any]] = {}

    def update_profiles(self, active_tracks: List[Track]) -> None:
        """
        Record historical data for all active tracks and maintain profiles.
        """
        for track in active_tracks:
            tid = track.track_id
            center = np.array([
                (track.bbox[0] + track.bbox[2]) / 2.0,
                (track.bbox[1] + track.bbox[3]) / 2.0,
                0.0
            ])
            
            if tid not in self.profiles:
                self.profiles[tid] = {
                    "id": tid,
                    "status": "active",
                    "history": [],
                    "joints_history": [],
                    "total_frames": 0
                }
                
            p = self.profiles[tid]
            p["status"] = "active"
            p["history"].append(center)
            if track.joints:
                p["joints_history"].append(track.joints)
            p["total_frames"] += 1
            
            # Limit history length
            if len(p["history"]) > self.history_limit:
                p["history"].pop(0)
            if len(p["joints_history"]) > self.history_limit:
                p["joints_history"].pop(0)
                
        # Mark missing tracks as inactive
        active_ids = {t.track_id for t in active_tracks}
        for tid, profile in self.profiles.items():
            if tid not in active_ids:
                profile["status"] = "inactive"

    def merge_redundant_tracks(self, tracks: List[Track]) -> List[Track]:
        """
        Identifies and merges duplicate tracks based on bounding box IoU.
        """
        if len(tracks) < 2:
            return tracks
            
        merged_tracks = []
        skip_indices = set()
        
        # Sort tracks by hit count to prioritize higher confidence tracks
        sorted_indices = sorted(range(len(tracks)), key=lambda idx: tracks[idx].hits, reverse=True)
        
        for i in range(len(sorted_indices)):
            idx_i = sorted_indices[i]
            if idx_i in skip_indices:
                continue
                
            track_i = tracks[idx_i]
            for j in range(i + 1, len(sorted_indices)):
                idx_j = sorted_indices[j]
                if idx_j in skip_indices:
                    continue
                    
                track_j = tracks[idx_j]
                iou_val = compute_iou(track_i.bbox, track_j.bbox)
                
                # If high overlap, merge J into I
                if iou_val >= self.merge_iou_threshold:
                    skip_indices.add(idx_j)
                    # Accumulate hits
                    track_i.hits += track_j.hits
                    # Merge joints if J has joints and I doesn't
                    if not track_i.joints and track_j.joints:
                        track_i.joints = track_j.joints
                        
            merged_tracks.append(track_i)
            
        return merged_tracks

    def get_track_history(self, track_id: int) -> List[np.ndarray]:
        """
        Returns list of 3D center points for a track.
        """
        if track_id in self.profiles:
            return self.profiles[track_id]["history"]
        return []
        
    def get_active_count(self) -> int:
        """
        Returns count of active profiles.
        """
        return sum(1 for p in self.profiles.values() if p["status"] == "active")
