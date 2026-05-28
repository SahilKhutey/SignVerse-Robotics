import math
import random

class SyntheticMotionGenerator:
    """
    Procedurally generates synthetic poses and gestures to bootstrap 
    the Reinforcement Learning engine and augment datasets.
    """
    def __init__(self):
        pass

    def generate_random_wave(self, frames=30):
        """Generates a synthetic 'wave' trajectory for the right wrist."""
        trajectory = []
        for i in range(frames):
            # Base wrist position
            x = 0.8
            y = 0.5
            
            # Sine wave oscillation
            dx = math.sin(i * 0.5) * 0.2
            
            # Add random domain-randomization noise
            noise_x = random.uniform(-0.02, 0.02)
            noise_y = random.uniform(-0.02, 0.02)
            
            trajectory.append({
                "wrist_x": x + dx + noise_x,
                "wrist_y": y + noise_y,
                "confidence": random.uniform(0.8, 1.0)
            })
            
        return trajectory

synthetic_factory = SyntheticMotionGenerator()
