import numpy as np
from typing import Dict, List, Any, Tuple, Optional

class ActionSegmenter:
    """
    Segments continuous human motion streams into discrete actions (e.g. Walk, Reach, Grasp, Place).
    """
    def __init__(self, velocity_threshold: float = 0.15, window_size: int = 15):
        self.velocity_threshold = velocity_threshold
        self.window_size = window_size
        # History of kinetic energy (mean velocity norm across key joints)
        self.energy_history: List[float] = []
        self.segment_timestamps: List[float] = []
        self.current_segment_id = 0

    def calculate_kinetic_energy(self, velocities: Dict[str, np.ndarray]) -> float:
        """
        Computes average kinetic energy (mean velocity magnitude) of the skeleton.
        """
        if not velocities:
            return 0.0
        magnitudes = [np.linalg.norm(v) for v in velocities.values()]
        return float(np.mean(magnitudes))

    def detect_segment_boundary(self, current_time: float, velocities: Dict[str, np.ndarray]) -> Tuple[bool, str]:
        """
        Detects action transitions based on kinetic energy peaks/valleys and thresholds.
        Returns: (is_boundary, current_action_state)
        """
        energy = self.calculate_kinetic_energy(velocities)
        self.energy_history.append(energy)
        
        if len(self.energy_history) > self.window_size:
            self.energy_history.pop(0)
            
        if len(self.energy_history) < 5:
            return False, "idle"
            
        # Segment boundary detection: detect if energy crosses the threshold or local minima
        is_boundary = False
        action = "idle"
        
        # Simple velocity-based state classification
        if energy > self.velocity_threshold:
            action = "active_motion"
        else:
            action = "static_hold"
            
        # Detect boundary if there is a transition from motion to static or vice versa
        # by checking local derivative of energy
        prev_energies = self.energy_history[:-1]
        mean_prev = np.mean(prev_energies)
        
        # If sudden drop or rise in kinetic energy compared to historical window
        if abs(energy - mean_prev) > self.velocity_threshold * 1.5:
            is_boundary = True
            self.current_segment_id += 1
            self.segment_timestamps.append(current_time)
            
        return is_boundary, action
