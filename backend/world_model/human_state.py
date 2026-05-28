from typing import Dict, Any, List
import time

class HumanStateTracker:
    """
    Maintains the persistent state of humans in the environment.
    Moves beyond instantaneous 'pose' into persistent 'person'.
    """
    def __init__(self):
        self.humans: Dict[str, Any] = {}
        self.active_gestures: List[Dict] = []
        
    def update_pose(self, human_id: str, pose_data: list):
        if human_id not in self.humans:
            self.humans[human_id] = {
                "id": human_id,
                "first_seen": time.time(),
                "last_seen": time.time(),
                "current_pose": None,
                "spatial_location": None, # (x,y,z) in world coordinates
                "intent": "unknown"
            }
            
        human = self.humans[human_id]
        human["last_seen"] = time.time()
        human["current_pose"] = pose_data
        
        # Calculate approximate spatial center (e.g. torso/hips)
        if len(pose_data) > 24: # Hips
            human["spatial_location"] = pose_data[24][:3]

    def register_gesture(self, human_id: str, gesture_data: dict):
        if human_id in self.humans:
            self.active_gestures.append({
                "human_id": human_id,
                "gesture": gesture_data.get("gesture"),
                "timestamp": time.time()
            })
            self.humans[human_id]["intent"] = gesture_data.get("gesture")
            
    def get_state(self):
        return {
            "humans_present": len(self.humans),
            "entities": self.humans,
            "recent_gestures": self.active_gestures[-5:]
        }
