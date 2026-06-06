"""Directed Graph representation of the Kinematic Skeleton."""
import numpy as np


class Node:
    def __init__(self, name, offset=None, axis=None):
        self.name = name
        self.offset = np.array(offset if offset is not None else [0.0, 0.0, 0.0], dtype=np.float64)
        self.axis = np.array(axis if axis is not None else [0.0, 0.0, 1.0], dtype=np.float64)
        axis_norm = np.linalg.norm(self.axis)
        if axis_norm > 1e-9:
            self.axis = self.axis / axis_norm
        self.children = []
        self.parent = None


class KinematicTree:
    def __init__(self):
        self.root = Node("PELVIS")
        self.nodes = {"PELVIS": self.root}

    def add_node(self, name, parent_name, offset=None, axis=None):
        if parent_name not in self.nodes:
            raise ValueError(f"Parent node {parent_name} not found in tree.")
        node = Node(name, offset, axis)
        node.parent = self.nodes[parent_name]
        self.nodes[parent_name].children.append(node)
        self.nodes[name] = node
        return node

    def add_bone(self, parent_name, child_name):
        """Standard bone link addition for backward compatibility."""
        if child_name not in self.nodes:
            self.add_node(child_name, parent_name)

