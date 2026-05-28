class RewardEngine:
    """
    Computes reward signals for Reinforcement Learning agents 
    controlling robot joints in simulation.
    """
    def __init__(self):
        pass

    def compute_motion_reward(self, current_pose: dict, target_pose: dict) -> float:
        """
        Calculates how close the robot's current joint angles are to the target 
        (e.g., matching a human's retargeted gesture).
        """
        # Simplistic L2 distance penalty
        penalty = 0.0
        for joint, target_angle in target_pose.items():
            current_angle = current_pose.get(joint, 0.0)
            penalty += abs(target_angle - current_angle)
            
        reward = max(0, 100.0 - penalty)
        return reward

rl_reward_engine = RewardEngine()
