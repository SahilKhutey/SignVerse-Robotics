import os
import json
from core.schemas.enums import JointType
from core.skeleton.joint import JointNode
from core.skeleton.skeleton_graph import SkeletonGraph
from core.motion.frame import MotionFrame
from core.motion.sequence import MotionSequence
from core.motion.serializer import MotionSerializer

def test_serialization():
    # Build a minimal SkeletonGraph
    graph = SkeletonGraph()
    shoulder = JointNode(id=1, joint_type=JointType.RIGHT_SHOULDER, x=1.0, y=2.0, z=0.0, confidence=0.99)
    elbow = JointNode(id=2, joint_type=JointType.RIGHT_ELBOW, x=1.0, y=1.0, z=0.0, confidence=0.95)
    
    graph.add_joint(shoulder)
    graph.add_joint(elbow)
    graph.connect(JointType.RIGHT_SHOULDER, JointType.RIGHT_ELBOW)
    
    # Create a frame
    frame = MotionFrame(frame_id=0, timestamp=0.0, skeleton=graph)
    
    # Create sequence
    seq = MotionSequence(sequence_id="test_seq_001")
    seq.add_frame(frame)
    
    # Serialize
    test_path = "test_output.json"
    MotionSerializer.save(seq, test_path)
    
    # Verify file exists and is valid json
    assert os.path.exists(test_path)
    
    loaded = MotionSerializer.load(test_path)
    assert loaded["sequence_id"] == "test_seq_001"
    assert len(loaded["frames"]) == 1
    
    f0 = loaded["frames"][0]
    assert f0["frame_id"] == 0
    assert "right_shoulder" in f0["skeleton"]
    assert f0["skeleton"]["right_shoulder"]["x"] == 1.0
    
    # Clean up
    os.remove(test_path)
    print("Serialization test passed!")

if __name__ == "__main__":
    test_serialization()
