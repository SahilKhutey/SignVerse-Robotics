import numpy as np
from typing import List, Dict, Tuple, Optional, Set

# MediaPipe Pose landmarks mapping
MEDIAPIPE_POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6), # Face
    (9, 10), # Mouth
    (11, 12), # Shoulders
    (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19), # Left Arm
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20), # Right Arm
    (11, 23), (12, 24), (23, 24), # Hips/Torso
    (23, 25), (25, 27), (27, 29), (29, 31), (27, 31), # Left Leg
    (24, 26), (26, 28), (28, 30), (30, 32), (28, 32)  # Right Leg
]

class SkeletonGraph:
    """
    Graph representation of human skeletal hierarchy and bone connections.
    """
    def __init__(self, hierarchy: Optional[Dict[str, List[str]]] = None):
        # Default hierarchy: root is pelvis/hip, branching to torso and legs
        if hierarchy is None:
            self.hierarchy = {
                "pelvis": ["spine", "left_hip", "right_hip"],
                "spine": ["neck"],
                "neck": ["head", "left_shoulder", "right_shoulder"],
                "left_shoulder": ["left_elbow"],
                "left_elbow": ["left_wrist"],
                "right_shoulder": ["right_elbow"],
                "right_elbow": ["right_wrist"],
                "left_hip": ["left_knee"],
                "left_knee": ["left_ankle"],
                "right_hip": ["right_knee"],
                "right_knee": ["right_ankle"]
            }
        else:
            self.hierarchy = hierarchy
            
        # Compute parents
        self.parents = {}
        for parent, children in self.hierarchy.items():
            for child in children:
                self.parents[child] = parent
                
        # Find root node(s) (nodes without parents)
        all_nodes = set(self.hierarchy.keys()) | set(self.parents.keys())
        self.roots = [node for node in all_nodes if node not in self.parents]

    def get_parent(self, joint_name: str) -> Optional[str]:
        """
        Get the parent joint name.
        """
        return self.parents.get(joint_name)

    def get_children(self, joint_name: str) -> List[str]:
        """
        Get list of children joint names.
        """
        return self.hierarchy.get(joint_name, [])

    def get_topological_ordering(self) -> List[str]:
        """
        Get a topological order of joints starting from roots.
        """
        visited = set()
        order = []
        
        def dfs(node):
            if node in visited:
                return
            visited.add(node)
            order.append(node)
            for child in self.get_children(node):
                dfs(child)
                
        for root in self.roots:
            dfs(root)
            
        return order
