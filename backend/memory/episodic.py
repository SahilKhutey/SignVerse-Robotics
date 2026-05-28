import time
from typing import List, Dict, Any

class EpisodicMemory:
    """
    Short-Term Episodic Memory buffer.
    Tracks recent interactions, gestures, and environment changes over time.
    """
    def __init__(self, max_episodes=500):
        self.max_episodes = max_episodes
        self.episodes: List[Dict[str, Any]] = []

    def record_episode(self, type: str, subject: str, action: str, context: dict = None):
        """Record a discreet event or interaction."""
        episode = {
            "timestamp": time.time(),
            "type": type,          # e.g., 'gesture', 'command', 'observation'
            "subject": subject,    # e.g., 'human_1', 'robot_1'
            "action": action,      # e.g., 'wave', 'move_to'
            "context": context or {}
        }
        self.episodes.append(episode)
        
        # Prune oldest memory
        if len(self.episodes) > self.max_episodes:
            self.episodes.pop(0)

    def retrieve_recent(self, limit: int = 10) -> List[Dict]:
        return self.episodes[-limit:]
        
    def find_action(self, action: str) -> List[Dict]:
        return [ep for ep in self.episodes if ep["action"] == action]

# Global instance for the OS Runtime
system_memory = EpisodicMemory()
