from core.schemas.enums import JointType
from core.skeleton.joint import JointNode


class SkeletonGraph:
    def __init__(self):
        self.joints: dict[JointType, JointNode] = {}
        self.edges: set[tuple[JointType, JointType]] = set()

    def add_joint(self, joint: JointNode) -> None:
        self.joints[joint.joint_type] = joint

    def connect(self, source: JointType, target: JointType) -> None:
        if source not in self.joints or target not in self.joints:
            raise ValueError("Both joints must be added before connecting them")
        self.edges.add((source, target))

    def to_dict(self) -> dict:
        return {
            joint_type.value: joint.to_dict()
            for joint_type, joint in sorted(
                self.joints.items(), key=lambda item: item[0].value
            )
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "SkeletonGraph":
        graph = cls()
        for joint_payload in payload.values():
            graph.add_joint(JointNode.from_dict(joint_payload))
        return graph
