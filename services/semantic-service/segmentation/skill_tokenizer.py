import numpy as np
from typing import Dict, Any, List

def tokenize_skills(action_segment: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dynamically converts a segmented action trajectory into skill primitives.
    Looks at joint velocity profiles and target distance keys in the action segment.
    """
    skill_tokens = []
    
    # Extract velocities and object distances if present
    velocities = action_segment.get("velocities", [])
    object_distances = action_segment.get("object_distances", [])
    
    if not velocities:
        # Fallback to default tokens if no telemetry data is passed
        return {
            "skill_tokens": ["approach", "reach", "grasp"]
        }
        
    avg_vel = np.mean(velocities)
    min_dist = np.min(object_distances) if object_distances else 999.0
    
    # 1. Approach Phase (indicated by initial peak velocity)
    if velocities[0] > avg_vel:
        skill_tokens.append("approach")
        
    # 2. Reach Phase (slowing down as object is approached)
    if min_dist < 50.0:
        skill_tokens.append("reach")
        
    # 3. Grasp Phase (extremely low distance / proximity contact)
    if min_dist < 15.0:
        skill_tokens.append("grasp")
        
    # 4. Lift/Transport Phase (velocity increases again after close contact)
    if "grasp" in skill_tokens and velocities[-1] > avg_vel * 0.5:
        skill_tokens.append("lift")
        
    # Fallback to make sure there's at least one skill token
    if not skill_tokens:
        skill_tokens = ["approach"]
        
    return {
        "skill_tokens": skill_tokens
    }
