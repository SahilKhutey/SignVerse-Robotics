import json
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

class SVMFModel(BaseModel):
    """
    Pydantic schema representation of the Sign-Verse Motion Format (SVMF).
    """
    skeleton_graph: Dict[str, Any]
    joint_angles: Dict[str, Any]
    velocities: Dict[str, Any]
    actions: Dict[str, Any]
    interactions: Dict[str, Any]
    embeddings: Dict[str, Any]

class SVMFExporter:
    """
    Handles exports and serialization into the Universal Sign-Verse Motion Format (SVMF).
    """
    @staticmethod
    def build_payload(
        skeleton_graph: Dict[str, Any],
        joint_angles: Dict[str, Any],
        velocities: Dict[str, Any],
        actions: Dict[str, Any],
        interactions: Dict[str, Any],
        embeddings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synthesizes individual components into an SVMF-compliant dictionary.
        """
        payload = {
            "skeleton_graph": skeleton_graph,
            "joint_angles": joint_angles,
            "velocities": velocities,
            "actions": actions,
            "interactions": interactions,
            "embeddings": embeddings
        }
        # Validate using Pydantic model
        validated = SVMFModel(**payload)
        return validated.model_dump()

    @classmethod
    def export_to_file(
        cls,
        filepath: str,
        skeleton_graph: Dict[str, Any],
        joint_angles: Dict[str, Any],
        velocities: Dict[str, Any],
        actions: Dict[str, Any],
        interactions: Dict[str, Any],
        embeddings: Dict[str, Any]
    ) -> None:
        """
        Serializes and writes SVMF data to a JSON file.
        """
        payload = cls.build_payload(
            skeleton_graph, joint_angles, velocities, actions, interactions, embeddings
        )
        with open(filepath, "w") as f:
            json.dump(payload, f, indent=2)
