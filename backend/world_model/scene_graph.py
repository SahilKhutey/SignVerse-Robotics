from typing import Dict, Any

class SceneGraph:
    """
    World Model Scene Graph.
    Maintains relationships between Humans, Robots, and Objects in the environment.
    """
    def __init__(self):
        self.nodes: Dict[str, Any] = {}
        self.edges = []
        
    def update_entity(self, entity_id: str, type: str, state: dict):
        self.nodes[entity_id] = {
            "type": type,
            "state": state
        }
        
    def add_relationship(self, subject_id: str, predicate: str, object_id: str):
        self.edges.append({
            "subject": subject_id,
            "predicate": predicate,
            "object": object_id
        })
        
    def get_context(self):
        return {
            "entities": self.nodes,
            "relationships": self.edges
        }

# Global instances for the OS Runtime
from backend.world_model.human_state import HumanStateTracker
world_scene = SceneGraph()
human_tracker = HumanStateTracker()
