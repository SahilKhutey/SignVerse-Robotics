import os
import sys
import numpy as np
import pytest

# Inject namespace path to resolve sign-verse-robotics packages
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
curr = TEST_DIR
while curr and not os.path.exists(os.path.join(curr, "packages", "motion-format", "svmf.py")):
    parent = os.path.dirname(curr)
    if parent == curr:
        break
    curr = parent
SVR_ROOT = curr

if SVR_ROOT not in sys.path:
    sys.path.insert(0, SVR_ROOT)


from motion_fusion import JointKalmanFilter, TemporalTracker, IdentityManager, SkeletonFusion
from kinematics import (
    SkeletonGraph, BoneVectorCalculator, JointAngleCalculator,
    QuaternionBuilder, VelocityEstimator, AccelerationEstimator
)
from motion_intelligence import ActionSegmenter, InteractionDetector, SkillExtractor, MotionEmbedder

import importlib.util
spec_svmf = importlib.util.spec_from_file_location(
    "svmf",
    f"{SVR_ROOT}/packages/motion-format/svmf.py"
)
svmf_module = importlib.util.module_from_spec(spec_svmf)
spec_svmf.loader.exec_module(svmf_module)
SVMFExporter = svmf_module.SVMFExporter

def test_motion_fusion_kalman_filter():
    kf = JointKalmanFilter(process_noise=1e-2, measurement_noise=1e-1)
    # Initialize with position
    kf.initialize(np.array([1.0, 2.0, 3.0]))
    assert kf.initialized
    
    # Predict step
    pred = kf.predict(0.1)
    assert pred.shape == (3,)
    
    # Update step
    updated = kf.update(np.array([1.1, 2.1, 3.1]))
    assert np.allclose(kf.x[:3], updated)
    assert np.linalg.norm(kf.get_velocity()) >= 0.0

def test_motion_fusion_temporal_tracker():
    tracker = TemporalTracker(min_iou=0.2)
    
    # Frame 1: Detection
    dets = [{"bbox": np.array([10, 10, 50, 50]), "joints": {"j1": np.array([1.0, 1.0, 1.0])}}]
    active = tracker.update(dets)
    assert len(active) == 1
    assert active[0].track_id == 1
    
    # Frame 2: Move slightly (should match)
    dets_moved = [{"bbox": np.array([12, 12, 52, 52])}]
    active_moved = tracker.update(dets_moved)
    assert len(active_moved) == 1
    assert active_moved[0].track_id == 1

def test_motion_fusion_identity_manager():
    mgr = IdentityManager(merge_iou_threshold=0.7)
    
    # Setup two mock tracks that overlap heavily
    from motion_fusion.temporal_tracker import Track
    t1 = Track(track_id=1, bbox=np.array([10, 10, 50, 50]))
    t2 = Track(track_id=2, bbox=np.array([11, 11, 49, 49]))
    t2.hits = 5
    
    merged = mgr.merge_redundant_tracks([t1, t2])
    # Heavy overlap should result in 1 merged track
    assert len(merged) == 1
    assert merged[0].hits == 6

def test_motion_fusion_skeleton_fusion():
    fusion = SkeletonFusion(min_confidence=0.2)
    f1 = {"joints": {"j1": {"x": 1.0, "y": 1.0, "z": 1.0, "confidence": 0.8}}}
    f2 = {"joints": {"j1": {"x": 2.0, "y": 2.0, "z": 2.0, "confidence": 0.2}}}
    
    fused = fusion.fuse([f1, f2])
    # Weighted average: (1.0*0.8 + 2.0*0.2) / (0.8 + 0.2) = 1.2
    assert np.isclose(fused["joints"]["j1"]["x"], 1.2)
    assert np.isclose(fused["joints"]["j1"]["confidence"], 0.5)

def test_kinematics_skeleton_graph():
    graph = SkeletonGraph()
    order = graph.get_topological_ordering()
    assert "pelvis" in order
    assert order[0] == "pelvis"  # Pelvis is root
    assert graph.get_parent("spine") == "pelvis"
    assert "neck" in graph.get_children("spine")

def test_kinematics_bone_vectors_and_angles():
    # Compute vector between root (0,0,0) and joint (0,2,0)
    vec = BoneVectorCalculator.compute_bone_vector(np.array([0.0, 0.0, 0.0]), np.array([0.0, 2.0, 0.0]))
    assert np.array_equal(vec, [0.0, 2.0, 0.0])
    
    length = BoneVectorCalculator.compute_bone_length(vec)
    assert np.isclose(length, 2.0)
    
    norm = BoneVectorCalculator.compute_normalized_direction(vec)
    assert np.array_equal(norm, [0.0, 1.0, 0.0])
    
    # Angle between [1,0,0] and [0,1,0] should be 90 degrees (pi/2)
    angle = JointAngleCalculator.compute_angle_between_vectors(np.array([1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0]))
    assert np.isclose(angle, np.pi / 2.0)

def test_kinematics_quaternion_builder():
    # Rotate [1,0,0] to [0,1,0]
    q = QuaternionBuilder.from_two_vectors(np.array([1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0]))
    # Rotate [1,0,0] using q
    from scipy.spatial.transform import Rotation
    r = Rotation.from_quat(q)
    rotated = r.apply([1.0, 0.0, 0.0])
    assert np.allclose(rotated, [0.0, 1.0, 0.0])

def test_kinematics_velocity_acceleration_estimators():
    vel_est = VelocityEstimator(alpha=1.0)
    acc_est = AccelerationEstimator(alpha=1.0)
    
    joints_t0 = {"j1": np.array([0.0, 0.0, 0.0])}
    joints_t1 = {"j1": np.array([0.1, 0.2, 0.3])}
    
    # Tick 1: v_est initializes
    v1 = vel_est.estimate(joints_t0, 0.1)
    assert np.allclose(v1["j1"], [0.0, 0.0, 0.0])
    
    # Tick 2: v_est computes velocity
    v2 = vel_est.estimate(joints_t1, 0.1)
    assert np.allclose(v2["j1"], [1.0, 2.0, 3.0])
    
    # Tick 1 for acceleration
    a1 = acc_est.estimate(v1, 0.1)
    assert np.allclose(a1["j1"], [0.0, 0.0, 0.0])
    
    # Tick 2 for acceleration
    a2 = acc_est.estimate(v2, 0.1)
    assert np.allclose(a2["j1"], [10.0, 20.0, 30.0])

def test_motion_intelligence_action_segmenter():
    segmenter = ActionSegmenter(velocity_threshold=0.1)
    
    # Warm up with low energy frames to fill the history window
    for i in range(4):
        segmenter.detect_segment_boundary(i * 0.1, {"j1": np.array([0.0, 0.0, 0.0])})
    
    # Low energy assertion
    boundary, action = segmenter.detect_segment_boundary(0.4, {"j1": np.array([0.0, 0.0, 0.0])})
    assert action == "static_hold"
    
    # High energy transition assertion
    boundary2, action2 = segmenter.detect_segment_boundary(0.5, {"j1": np.array([1.0, 1.0, 1.0])})
    assert action2 == "active_motion"
    # Transition from static to active should trigger a boundary
    assert boundary2

def test_motion_intelligence_interaction_detector():
    detector = InteractionDetector(interaction_threshold=0.2)
    
    hand_pos = {"right_hand": np.array([0.5, 0.5, 0.5])}
    obj_pos = {"cube_01": np.array([0.55, 0.52, 0.51])}
    
    interactions = detector.detect(hand_pos, obj_pos)
    assert len(interactions) == 1
    assert interactions[0]["state"] == "grasp"
    assert interactions[0]["object_id"] == "cube_01"

def test_motion_intelligence_skill_extractor():
    extractor = SkillExtractor()
    
    # Simple simulated sequence
    joint_history = [
        {"pelvis": np.array([0.0, 0.0, 0.0]), "left_hand": np.array([0.0, 0.0, 0.0])},
        {"pelvis": np.array([0.1, 0.0, 0.0]), "left_hand": np.array([0.0, 0.0, 0.0])},  # Walk
        {"pelvis": np.array([0.2, 0.0, 0.0]), "left_hand": np.array([0.2, 0.0, 0.0])},  # Walk + hand move
    ]
    # No active interactions
    interactions_history = [[], [], []]
    
    res = extractor.extract_from_history(joint_history, interactions_history)
    assert "skill_sequence" in res
    assert len(res["skill_sequence"]) > 0

def test_motion_intelligence_motion_embeddings():
    embedder = MotionEmbedder(embedding_dim=128)
    
    joint_seq = [
        {"pelvis": np.array([0.0, 0.0, 0.0]), "left_hand": np.array([0.1, 0.1, 0.1])},
        {"pelvis": np.array([0.01, 0.0, 0.0]), "left_hand": np.array([0.15, 0.15, 0.15])},
    ]
    
    emb = embedder.embed(joint_seq)
    assert emb.shape == (128,)
    # Verify unit normalized
    assert np.isclose(np.linalg.norm(emb), 1.0)

def test_universal_motion_format_svmf():
    graph = {"nodes": ["pelvis"]}
    angles = {"j1": 0.5}
    vels = {"j1": [0.1, 0.0, 0.0]}
    actions = {"current": "walk"}
    interactions = {"state": "none"}
    embeddings = {"val": [0.1]*128}
    
    payload = SVMFExporter.build_payload(graph, angles, vels, actions, interactions, embeddings)
    assert "skeleton_graph" in payload
    assert "joint_angles" in payload
    assert "velocities" in payload
    assert "embeddings" in payload
    assert len(payload["embeddings"]) == 1

def test_motion_compression():
    spec_comp = importlib.util.spec_from_file_location(
        "compression",
        f"{SVR_ROOT}/packages/motion-format/compression.py"
    )
    comp_module = importlib.util.module_from_spec(spec_comp)
    spec_comp.loader.exec_module(comp_module)
    compress_motion_sequence = comp_module.compress_motion_sequence
    decompress_motion_sequence = comp_module.decompress_motion_sequence

    seq = [
        {"translation": [0.0, 0.0, 0.0], "joints": {"J0": 0.0, "J1": 0.0}},
        {"translation": [0.0501, 0.1001, 0.1501], "joints": {"J0": 0.5001, "J1": -0.2501}},  # Should be decimated under tolerance=0.01
        {"translation": [0.1, 0.2, 0.3], "joints": {"J0": 1.0, "J1": -0.5}}
    ]
    
    compressed = compress_motion_sequence(seq, tolerance=0.01)
    # The middle frame should be decimated, leaving 2 frames
    assert len(compressed) == 2
    assert compressed[1]["is_keyframe"] is True
    
    decompressed = decompress_motion_sequence(compressed)
    assert len(decompressed) == 2
    assert np.allclose(decompressed[1]["translation"], [0.1, 0.2, 0.3])
    assert np.isclose(decompressed[1]["joints"]["J0"], 1.0)

