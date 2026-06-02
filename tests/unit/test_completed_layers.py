import os
import sys
import json
import types
import numpy as np
import pytest
import importlib.util
import shutil

# ── Resolve workspace root and inject namespace paths ─────────────────────────
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
parts = TEST_DIR.replace('\\', '/').split('/')
if "sign-verse-robotics" in parts:
    idx = parts.index("sign-verse-robotics")
    SVR_ROOT = "/".join(parts[:idx+1])
else:
    curr = TEST_DIR
    SVR_ROOT = curr
    while curr:
        if os.path.exists(os.path.join(curr, "sign-verse-robotics")):
            SVR_ROOT = os.path.join(curr, "sign-verse-robotics")
            break
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
WORKSPACE_ROOT = os.path.dirname(SVR_ROOT)
EDGE_RT  = os.path.join(WORKSPACE_ROOT, "robotics", "edge-runtime")



for p in [SVR_ROOT, EDGE_RT]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Merge core namespace packages
if "core" not in sys.modules:
    core_pkg = types.ModuleType("core")
    core_pkg.__path__ = [os.path.join(SVR_ROOT, "core")]
    core_pkg.__package__ = "core"
    sys.modules["core"] = core_pkg
else:
    svr_core = os.path.join(SVR_ROOT, "core")
    core_path = sys.modules["core"].__path__
    if svr_core not in core_path:
        if hasattr(core_path, "append"):
            core_path.append(svr_core)
        else:
            sys.modules["core"].__path__ = [svr_core] + list(core_path)


# ── Dynamic Import Resolution for Hyphenated Service Paths ───────────────────
# 1. Motion Fusion Service
spec_fusion = importlib.util.spec_from_file_location(
    "fusion_engine",
    f"{SVR_ROOT}/services/motion-fusion-service/fusion_engine.py"
)
fusion_module = importlib.util.module_from_spec(spec_fusion)
spec_fusion.loader.exec_module(fusion_module)
SkeletonFusionEngine = fusion_module.SkeletonFusionEngine

# 2. Ingestion Service
sys.path.append(f"{SVR_ROOT}/services/ingestion-service")
spec_ingest = importlib.util.spec_from_file_location(
    "rtsp_ingester",
    f"{SVR_ROOT}/services/ingestion-service/streaming/rtsp_ingester.py"
)
ingest_module = importlib.util.module_from_spec(spec_ingest)
spec_ingest.loader.exec_module(ingest_module)
RTSPIngester = ingest_module.RTSPIngester

# 3. Perception Service
spec_quant = importlib.util.spec_from_file_location(
    "quantize",
    f"{SVR_ROOT}/services/perception-service/yolo/quantize.py"
)
quant_module = importlib.util.module_from_spec(spec_quant)
spec_quant.loader.exec_module(quant_module)
ONNXQuantizer = quant_module.ONNXQuantizer

# ── Standard Imports ──────────────────────────────────────────────────────────
from core.robotics.kinematics.forward_kinematics import ForwardKinematics
from core.robotics.retargeting.occlusion_recovery import OcclusionRecoveryFilter
from core.robotics.ros.ros2_exporter import ROS2JointStateExporter
from datasets.builder import build_dataset


def test_forward_kinematics_hierarchical_offsets():
    # Define a simple shoulder -> elbow -> wrist joint hierarchy
    hierarchy = {
        "root": ["shoulder"],
        "shoulder": ["elbow"],
        "elbow": ["wrist"]
    }
    # Assume 1.0 unit length for each bone link
    bone_lengths = {
        "shoulder": 1.0,
        "elbow": 1.0,
        "wrist": 1.0
    }
    
    fk = ForwardKinematics(hierarchy=hierarchy, bone_lengths=bone_lengths)
    
    rotations = {
        "root": [0.0, 0.0, 0.0, 1.0],
        "shoulder": [0.0, 0.0, 0.0, 1.0],
        "elbow": [0.0, 0.0, 0.0, 1.0],
        "wrist": [0.0, 0.0, 0.0, 1.0]
    }
    
    positions = fk.compute(rotations, root_pos=np.array([0.0, 0.0, 0.0]))
    
    assert "root" in positions
    assert np.allclose(positions["root"], [0.0, 0.0, 0.0])
    
    # Shoulder position should be parent + offset (0.0, 1.0, 0.0)
    assert np.allclose(positions["shoulder"], [0.0, 1.0, 0.0])
    # Elbow should compound to (0.0, 2.0, 0.0)
    assert np.allclose(positions["elbow"], [0.0, 2.0, 0.0])
    # Wrist should compound to (0.0, 3.0, 0.0)
    assert np.allclose(positions["wrist"], [0.0, 3.0, 0.0])

def test_occlusion_recovery_symmetry_and_temporal():
    # 1. Temporal recover: carry forward from prev_frame
    current_frame = {
        "joints": {
            "left_elbow": {"x": 1.0, "y": 2.0, "z": 3.0, "confidence": 0.05}
        }
    }
    prev_frame = {
        "joints": {
            "left_elbow": {"x": 1.0, "y": 2.0, "z": 3.0, "confidence": 0.9}
        }
    }
    
    recovered = OcclusionRecoveryFilter.recover_occlusions(current_frame, prev_frame)
    assert recovered["joints"]["left_elbow"]["confidence"] > 0.5
    assert np.isclose(recovered["joints"]["left_elbow"]["x"], 1.0)
    
    # 2. Symmetry recover: mirror Right shoulder position when Left shoulder is occluded
    current_frame_mirror = {
        "joints": {
            "left_shoulder": {"x": 0.0, "y": 0.0, "z": 0.0, "confidence": 0.0},
            "right_shoulder": {"x": 0.5, "y": 1.0, "z": 1.5, "confidence": 0.8}
        }
    }
    recovered_mirror = OcclusionRecoveryFilter.recover_occlusions(current_frame_mirror, None)
    assert recovered_mirror["joints"]["left_shoulder"]["confidence"] > 0.2
    assert np.isclose(recovered_mirror["joints"]["left_shoulder"]["x"], -0.5)
    assert np.isclose(recovered_mirror["joints"]["left_shoulder"]["y"], 1.0)
    assert np.isclose(recovered_mirror["joints"]["left_shoulder"]["z"], 1.5)

def test_skeleton_fusion_engine_weighted_averages():
    f1 = {
        "joints": {
            "left_hand": {"x": 1.0, "y": 1.0, "z": 1.0, "confidence": 0.8}
        }
    }
    f2 = {
        "joints": {
            "left_hand": {"x": 2.0, "y": 2.0, "z": 2.0, "confidence": 0.2}
        }
    }
    
    fused = SkeletonFusionEngine.fuse_joints([f1, f2])
    fused_joint = fused["joints"]["left_hand"]
    
    assert np.isclose(fused_joint["x"], 1.2)
    assert np.isclose(fused_joint["y"], 1.2)
    assert np.isclose(fused_joint["z"], 1.2)
    assert np.isclose(fused_joint["confidence"], 0.5)

def test_ros2_joint_state_exporter():
    joint_names = ["joint_0", "joint_1"]
    positions = [0.5, -0.2]
    
    msg = ROS2JointStateExporter.serialize_joint_state(joint_names, positions)
    
    assert "header" in msg
    assert "stamp" in msg["header"]
    assert msg["name"] == joint_names
    assert msg["position"] == positions
    assert len(msg["velocity"]) == 2
    assert len(msg["effort"]) == 2

def test_dataset_builder_packaging():
    output_dir = f"{SVR_ROOT}/.tmp_test_completed_layers"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
        
    dataset_id = "test_run_01"
    metadata = {"author": "SignVerse", "task": "Reach"}
    skills = {"approach": 1.0}
    objects = ["cube"]
    
    sequences = [{
        "sequence_id": "traj_0",
        "frames": [
            {
                "joints": {
                    "J0": {"x": 0.1, "y": 0.2, "z": 0.3, "confidence": 0.9}
                }
            }
        ]
    }]
    
    try:
        result = build_dataset(output_dir, dataset_id, metadata, sequences, objects, skills)
        
        assert os.path.exists(result["manifest"])
        assert os.path.exists(result["archive"])
        
        with open(result["manifest"], "r") as f:
            manifest = json.load(f)
            assert manifest["dataset_id"] == dataset_id
            assert manifest["sequences_count"] == 1
            
        archive_data = np.load(result["archive"])
        assert "traj_0" in archive_data
        assert archive_data["traj_0"].shape == (1, 4)
        assert np.allclose(archive_data["traj_0"][0], [0.1, 0.2, 0.3, 0.9])
        archive_data.close() # Close to release file handle lock
    finally:
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)

def test_dataset_builder_svmf_packaging():
    from datasets.builder import SVMFDataset
    output_dir = f"{SVR_ROOT}/.tmp_test_completed_layers_svmf"
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
        
    dataset_id = "test_svmf_run"
    metadata = {"author": "SignVerse", "task": "Reach"}
    skills = {"approach": 1.0}
    objects = ["cube"]
    
    sequences = [{
        "sequence_id": "traj_svmf_0",
        "skeleton_graph": {"nodes": ["pelvis", "spine"]},
        "joint_angles": {
            "J0": [0.1, 0.2, 0.3],
            "J1": [0.4, 0.5, 0.6],
            "J2": [0.7, 0.8, 0.9]
        },
        "translation": [[0.0, 0.0, 0.0], [0.01, 0.02, 0.03], [0.1, 0.2, 0.3]],
        "frames": [
            {"joints": {"J0": 0.1, "J1": 0.4, "J2": 0.7}},
            {"joints": {"J0": 0.2, "J1": 0.5, "J2": 0.8}},
            {"joints": {"J0": 0.3, "J1": 0.6, "J2": 0.9}}
        ]
    }]
    
    try:
        result = build_dataset(output_dir, dataset_id, metadata, sequences, objects, skills, generate_svmf=True)
        svmf_file = os.path.join(output_dir, "svmf", "traj_svmf_0.svmf.json")
        comp_file = os.path.join(output_dir, "svmf", "traj_svmf_0_compressed.svmf.json")
        
        assert os.path.exists(svmf_file)
        assert os.path.exists(comp_file)
        
        # Load dataset from SVMF file
        ds = SVMFDataset(svmf_file, normalise=False, input_dim=3, output_dim=3)
        assert len(ds) == 3
        obs, lbl = ds[0]
        assert obs.shape == (3,)
        assert lbl.shape == (3,)
        assert np.allclose(obs.numpy(), [0.1, 0.4, 0.7])
        assert np.allclose(lbl.numpy(), [0.1, 0.4, 0.7])
    finally:
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)

