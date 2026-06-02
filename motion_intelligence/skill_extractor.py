import numpy as np
from typing import List, Dict, Any

class SkillExtractor:
    """
    Translates raw joint trajectories and interactions into a sequence of tokenized high-level skills.
    Supported skill tokens: walk, reach, grasp, place, wave, sit, stand.
    """
    def __init__(self):
        self.skills: List[str] = []

    def extract_from_history(self, joint_history: List[Dict[str, np.ndarray]], interactions_history: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Processes history to build a sequence of high-level skills.
        Each item in joint_history maps joint name -> 3D position vector.
        Each item in interactions_history is a list of active interactions.
        """
        sequence = []
        
        # Guard if histories are empty
        if not joint_history:
            return {"skill_sequence": []}
            
        # Segment and classify the sequence
        n_frames = len(joint_history)
        
        # Analyze blocks of frames (e.g. every 10 frames) to determine the dominant skill
        step = max(1, n_frames // 10)
        for i in range(0, n_frames, step):
            frame_joints = joint_history[i]
            frame_interactions = interactions_history[i] if i < len(interactions_history) else []
            
            # Extract features for this frame block
            # 1. Check sit/stand (pelvis/hip height)
            pelvis_pos = frame_joints.get("pelvis", np.zeros(3))
            pelvis_height = pelvis_pos[1]  # Y coordinate is typically height
            
            # 2. Check hand-object interaction
            has_grasp = any(inter.get("state") == "grasp" for inter in frame_interactions)
            has_place = any(inter.get("state") == "place" for inter in frame_interactions)
            has_reach = any(inter.get("state") == "approach" for inter in frame_interactions)
            
            # 3. Check velocities (e.g., hand movements vs pelvis movement)
            # Find velocity if history has previous
            pelvis_vel = 0.0
            left_hand_vel = 0.0
            if i > 0:
                prev_joints = joint_history[i - 1]
                pelvis_vel = np.linalg.norm(pelvis_pos - prev_joints.get("pelvis", np.zeros(3)))
                left_hand_vel = np.linalg.norm(frame_joints.get("left_hand", np.zeros(3)) - prev_joints.get("left_hand", np.zeros(3)))
            
            # Classify frame state
            if has_grasp:
                token = "grasp"
            elif has_place:
                token = "place"
            elif has_reach:
                token = "reach"
            elif pelvis_vel > 0.05:
                token = "walk"
            elif left_hand_vel > 0.1:
                # Oscillatory hand movement check (crude wave detection)
                token = "wave"
            elif pelvis_height < 0.5:
                token = "sit"
            else:
                token = "stand"
                
            # Append if different from last token to keep sequence clean
            if not sequence or sequence[-1] != token:
                sequence.append(token)
                
        # Post-process sequence to remove transient states or idle states if needed
        # and ensure a valid sequence (e.g. reach -> grasp -> place)
        # Filter down to the core tokens
        valid_tokens = {"walk", "reach", "grasp", "place", "wave", "sit", "stand"}
        sequence = [t for t in sequence if t in valid_tokens]
        
        # Deduplicate consecutive tokens
        deduped = []
        for token in sequence:
            if not deduped or deduped[-1] != token:
                deduped.append(token)
                
        return {"skill_sequence": deduped}
