import numpy as np
from typing import Dict, Any, List, Optional, Tuple

class InteractionDetector:
    """
    Detects and classifies physical interactions between human hands and external objects.
    """
    def __init__(self, interaction_threshold: float = 0.25):
        self.interaction_threshold = interaction_threshold
        # Keep track of active grasps: {hand_name: object_id}
        self.active_interactions: Dict[str, str] = {}

    def detect(self, hand_positions: Dict[str, np.ndarray], object_positions: Dict[str, np.ndarray]) -> List[Dict[str, Any]]:
        """
        Detects proximity-based interactions.
        hand_positions: {'left_hand': [x, y, z], 'right_hand': [x, y, z]}
        object_positions: {'object_1': [x, y, z], ...}
        """
        interactions = []
        for hand_name, hand_pos in hand_positions.items():
            hand_arr = np.array(hand_pos)
            best_obj = None
            min_dist = float('inf')
            
            for obj_id, obj_pos in object_positions.items():
                obj_arr = np.array(obj_pos)
                dist = np.linalg.norm(hand_arr - obj_arr)
                if dist < min_dist:
                    min_dist = dist
                    best_obj = obj_id
                    
            if best_obj and min_dist <= self.interaction_threshold:
                # Classify interaction state: grasp if distance is very small
                state = "grasp" if min_dist < 0.1 else "approach"
                self.active_interactions[hand_name] = best_obj
                
                interactions.append({
                    "hand": hand_name,
                    "object_id": best_obj,
                    "distance": min_dist,
                    "state": state
                })
            else:
                # If hand was previously interacting with an object and is now far, it's a release/place
                if hand_name in self.active_interactions:
                    prev_obj = self.active_interactions[hand_name]
                    interactions.append({
                        "hand": hand_name,
                        "object_id": prev_obj,
                        "distance": min_dist,
                        "state": "place"
                    })
                    del self.active_interactions[hand_name]
                    
        return interactions
