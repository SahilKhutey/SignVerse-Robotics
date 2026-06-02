import os
import sys
import json
import shutil
import numpy as np
import pytest
import torch
import importlib.util

# ── Resolve pathing dynamically ────────────────────────────────────────────────
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

# Core imports
from motion_fusion import JointKalmanFilter, TemporalTracker, IdentityManager, SkeletonFusion
from kinematics import (
    SkeletonGraph, BoneVectorCalculator, JointAngleCalculator,
    QuaternionBuilder, VelocityEstimator, AccelerationEstimator
)
from motion_intelligence import ActionSegmenter, InteractionDetector, SkillExtractor, MotionEmbedder
from backend.robotics.manager import DummyWebSocketRobot, RoboticsCommandBus
from datasets.builder import build_dataset, SVMFDataset

# Dynamic loading for hyphenated modules
spec_comp = importlib.util.spec_from_file_location(
    "compression",
    f"{SVR_ROOT}/packages/motion-format/compression.py"
)
comp_module = importlib.util.module_from_spec(spec_comp)
spec_comp.loader.exec_module(comp_module)
compress_motion_sequence = comp_module.compress_motion_sequence
decompress_motion_sequence = comp_module.decompress_motion_sequence


# ─── 1. Kinematics & Graph Tests ──────────────────────────────────────────────

def test_skeletal_topology_and_graphs():
    """Verify directed joints connectivity and bone length estimation."""
    graph = SkeletonGraph()
    order = graph.get_topological_ordering()
    assert order[0] == "pelvis", "Pelvis must be the skeletal hierarchy root"
    assert graph.get_parent("spine") == "pelvis"
    
    # Bone vector directional and norm checks
    p1 = np.array([0.0, 0.0, 0.0])
    p2 = np.array([0.0, 3.0, 0.0])
    vec = BoneVectorCalculator.compute_bone_vector(p1, p2)
    assert np.array_equal(vec, [0.0, 3.0, 0.0])
    assert np.isclose(BoneVectorCalculator.compute_bone_length(vec), 3.0)
    assert np.array_equal(BoneVectorCalculator.compute_normalized_direction(vec), [0.0, 1.0, 0.0])


def test_rotations_and_angular_kinematics():
    """Verify hinge Euler angles and SLERP quaternion conversions."""
    # 90 degree angle check between positive X and Y axes
    v_x = np.array([1.0, 0.0, 0.0])
    v_y = np.array([0.0, 1.0, 0.0])
    angle = JointAngleCalculator.compute_angle_between_vectors(v_x, v_y)
    assert np.isclose(angle, np.pi / 2)
    
    # Quaternion conversion from vectors
    q = QuaternionBuilder.from_two_vectors(v_x, v_y)
    from scipy.spatial.transform import Rotation
    r = Rotation.from_quat(q)
    rotated = r.apply(v_x)
    assert np.allclose(rotated, v_y)


# ─── 2. Motion Fusion Tests ───────────────────────────────────────────────────

def test_skeleton_confidence_fusion():
    """Verify coordinate merging weighted by provider detection confidence."""
    fusion = SkeletonFusion(min_confidence=0.1)
    prov_a = {"joints": {"elbow": {"x": 1.0, "y": 1.0, "z": 1.0, "confidence": 0.8}}}
    prov_b = {"joints": {"elbow": {"x": 2.0, "y": 2.0, "z": 2.0, "confidence": 0.2}}}
    
    fused = fusion.fuse([prov_a, prov_b])
    # Expect: (1.0 * 0.8 + 2.0 * 0.2) / (0.8 + 0.2) = 1.2
    assert np.isclose(fused["joints"]["elbow"]["x"], 1.2)
    assert np.isclose(fused["joints"]["elbow"]["confidence"], 0.5)


def test_vectorized_joint_filtering():
    """Verify Kalman filter corrections on noisy coordinates."""
    kf = JointKalmanFilter(process_noise=1e-3, measurement_noise=1e-2)
    kf.initialize(np.array([1.0, 1.0, 1.0]))
    
    pred = kf.predict(0.1)
    assert pred.shape == (3,)
    
    updated = kf.update(np.array([1.05, 0.98, 1.02]))
    assert np.allclose(kf.x[:3], updated)


# ─── 3. Motion Intelligence Tests ─────────────────────────────────────────────

def test_energy_action_segmentation():
    """Verify segment boundary detection under sudden velocity transitions."""
    segmenter = ActionSegmenter(velocity_threshold=0.15)
    
    # Static frames
    for i in range(5):
        segmenter.detect_segment_boundary(i * 0.1, {"shoulder": np.array([0.0, 0.0, 0.0])})
        
    boundary, mode = segmenter.detect_segment_boundary(0.5, {"shoulder": np.array([0.0, 0.0, 0.0])})
    assert mode == "static_hold"
    
    # Active frame
    boundary, mode = segmenter.detect_segment_boundary(0.6, {"shoulder": np.array([2.0, 2.0, 2.0])})
    assert mode == "active_motion"
    assert boundary, "Sudden velocity shift should trigger action boundary"


def test_semantic_skill_extraction():
    """Verify conversion of coordinate histories into symbolic skill arrays."""
    extractor = SkillExtractor()
    history = [
        {"pelvis": np.array([0.0, 0.0, 0.0])},
        {"pelvis": np.array([0.15, 0.0, 0.0])},
        {"pelvis": np.array([0.3, 0.0, 0.0])}
    ]
    res = extractor.extract_from_history(history, [[], [], []])
    assert "skill_sequence" in res
    assert "walk" in res["skill_sequence"]


# ─── 4. Universal Format & Compression Tests ──────────────────────────────────

def test_delta_keyframe_compression():
    """Verify keyframe decimation and delta compression/decompression loop."""
    seq = [
        {"translation": [0.0, 0.0, 0.0], "joints": {"J0": 0.0}},
        {"translation": [0.0501, 0.1001, 0.1501], "joints": {"J0": 0.5001}},  # Near linear middle
        {"translation": [0.1, 0.2, 0.3], "joints": {"J0": 1.0}}
    ]
    
    compressed = compress_motion_sequence(seq, tolerance=0.01)
    assert len(compressed) == 2, "Middle frame should be decimated"
    
    decompressed = decompress_motion_sequence(compressed)
    assert len(decompressed) == 2
    assert np.allclose(decompressed[1]["translation"], [0.1, 0.2, 0.3])
    assert np.isclose(decompressed[1]["joints"]["J0"], 1.0)


# ─── 5. Dataset packaging & DataLoader Loader Tests ─────────────────────────

def test_dataset_packaging_to_pytorch_dataset():
    """Verify SVMF file generation and custom SVMFDataset dataloader parsing."""
    output_dir = os.path.join(SVR_ROOT, ".tmp_all_workings_test")
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
        
    dataset_id = "workings_dataset_run"
    metadata = {"author": "SignVerse", "task": "Consolidated Test"}
    skills = {"reach": 1.0}
    objects = ["gripper"]
    
    sequences = [{
        "sequence_id": "traj_0",
        "skeleton_graph": {"nodes": ["pelvis"]},
        "joint_angles": {
            "J0": [0.1, 0.2],
            "J1": [0.3, 0.4]
        },
        "translation": [[0.0, 0.0, 0.0], [0.1, 0.1, 0.1]],
        "frames": [
            {"joints": {"J0": 0.1, "J1": 0.3}},
            {"joints": {"J0": 0.2, "J1": 0.4}}
        ]
    }]
    
    try:
        # Save SVMF
        build_dataset(output_dir, dataset_id, metadata, sequences, objects, skills, generate_svmf=True)
        svmf_file = os.path.join(output_dir, "svmf", "traj_0.svmf.json")
        assert os.path.exists(svmf_file)
        
        # Load via PyTorch SVMFDataset
        ds = SVMFDataset(svmf_file, normalise=False, input_dim=2, output_dim=2)
        assert len(ds) == 2
        obs, lbl = ds[0]
        assert obs.shape == (2,)
        assert lbl.shape == (2,)
        assert np.allclose(obs.numpy(), [0.1, 0.3])
        assert np.allclose(lbl.numpy(), [0.1, 0.3])
    finally:
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)


# ─── 6. Robotics Manager Tests ────────────────────────────────────────────────

def test_robotics_command_bus_broadcast():
    """Verify connection, registration, and coordinate broadcasting to robots."""
    bus = RoboticsCommandBus()
    r1 = DummyWebSocketRobot("bot_1")
    r2 = DummyWebSocketRobot("bot_2")
    
    # Test compat registration
    bus.register(r1)
    bus.register(r2)
    
    assert bus.get_robot("bot_1") is r1
    assert r1.connected
    assert r2.connected
    
    # Test broadcast
    pose = {"J0": 0.5, "J1": -0.8}
    bus.broadcast_pose(pose)
    
    assert r1.current_angles == pose
    assert r2.current_angles == pose
