import json
import os
import uuid
from pathlib import Path
import pytest

from core.robotics.simulation.blender_exporter import BlenderExporter
from core.robotics.simulation.isaac_exporter import IsaacExporter

@pytest.fixture
def sample_motion_sequence():
    """
    Returns a sample motion sequence representing a 3D robotic arm trajectory.
    """
    return [
        {
            "translation": [0.0, 0.0, 0.0],
            "joints": {"J0": 0.0, "J1": 45.0, "J2": 90.0}
        },
        {
            "translation": [0.1, 0.2, 0.3],
            "joints": {"J0": 10.0, "J1": 50.0, "J2": 95.0}
        },
        {
            "translation": [0.2, 0.4, 0.6],
            "joints": {"J0": 20.0, "J1": 55.0, "J2": 100.0}
        }
    ]

@pytest.fixture
def temp_dir():
    """
    Creates and returns a temporary directory path for test outputs.
    """
    path = Path(".tmp_test_artifacts") / f"exporters_{uuid.uuid4().hex}"
    os.makedirs(path, exist_ok=True)
    yield path
    # Cleanup files in the directory
    if path.exists():
        for f in path.glob("*"):
            try:
                f.unlink()
            except OSError:
                pass
        try:
            path.rmdir()
        except OSError:
            pass

def test_blender_exporter_bvh(sample_motion_sequence, temp_dir):
    exporter = BlenderExporter()
    bvh_path = temp_dir / "motion.bvh"
    
    # Export and verify return status
    success = exporter.export(sample_motion_sequence, str(bvh_path), format_type="bvh")
    assert success is True
    assert bvh_path.exists()
    
    # Read and inspect content
    content = bvh_path.read_text(encoding="utf-8")
    assert "HIERARCHY" in content
    assert "ROOT Pelvis" in content
    assert "JOINT Joint0" in content
    assert "JOINT Joint1" in content
    assert "JOINT Joint2" in content
    assert "MOTION" in content
    assert "Frames: 3" in content
    assert "0.000000 0.200000 0.400000" not in content  # checks that animation translation is written correctly
    assert "0.000000 0.000000 0.000000 0.0 0.0 0.0 0.000000" in content
    assert "0.100000 0.200000 0.300000 0.0 0.0 0.0 10.000000" in content

def test_blender_exporter_fbx(sample_motion_sequence, temp_dir):
    exporter = BlenderExporter()
    fbx_path = temp_dir / "motion.fbx"
    
    # Export with auto-detected format type from extension
    success = exporter.export(sample_motion_sequence, str(fbx_path))
    assert success is True
    assert fbx_path.exists()
    
    # Read and inspect content
    content = fbx_path.read_text(encoding="utf-8")
    assert "FBXHeaderExtension" in content
    assert "FBXVersion: 7400" in content
    assert "Model: 1001, \"Model::Pelvis\"" in content
    assert "Model: 1002, \"Model::Joint0\"" in content
    assert "Model: 1003, \"Model::Joint1\"" in content
    assert "Model: 1004, \"Model::Joint2\"" in content
    assert "AnimationStack: 2001" in content
    assert "AnimationCurveNode: 3001" in content
    
    # Check curves
    assert "AnimCurve::T_X" in content
    assert "AnimCurve::R_J0_X" in content
    assert "KeyValueFloat: *3" in content
    # Frame ticks check
    assert "0,1539541400,3079082800" in content

def test_blender_exporter_empty(temp_dir):
    exporter = BlenderExporter()
    bvh_path = temp_dir / "empty.bvh"
    
    success = exporter.export([], str(bvh_path), format_type="bvh")
    assert success is True
    content = bvh_path.read_text(encoding="utf-8")
    assert "Frames: 0" in content

def test_isaac_exporter_usd(sample_motion_sequence, temp_dir):
    exporter = IsaacExporter()
    usd_path = temp_dir / "motion.usda"
    
    success = exporter.export(sample_motion_sequence, str(usd_path), format_type="usd")
    assert success is True
    assert usd_path.exists()
    
    content = usd_path.read_text(encoding="utf-8")
    assert "#usda 1.0" in content
    assert "def Xform \"World\"" in content
    assert "def Xform \"RobotPelvis\"" in content
    assert "def Xform \"Link0\"" in content
    assert "double3 xformOp:translate.timeSamples = {" in content
    assert "1.0: (0.0000, 0.0000, 0.0000)" in content
    assert "2.0: (0.1000, 0.2000, 0.3000)" in content
    assert "3.0: (0.2000, 0.4000, 0.6000)" in content
    assert "double3 xformOp:rotateXYZ.timeSamples = {" in content

def test_isaac_exporter_json(sample_motion_sequence, temp_dir):
    exporter = IsaacExporter()
    json_path = temp_dir / "motion.json"
    
    success = exporter.export(sample_motion_sequence, str(json_path), format_type="json")
    assert success is True
    assert json_path.exists()
    
    # Parse and inspect json structure
    data = json.loads(json_path.read_text(encoding="utf-8"))
    assert data["metadata"]["num_frames"] == 3
    assert data["metadata"]["robot_type"] == "3d_arm"
    assert data["metadata"]["joint_names"] == ["J0", "J1", "J2"]
    
    # Check states and actions tensors
    # state shape is [pos_x, pos_y, pos_z, rot_x (rad), rot_y (rad), rot_z (rad), j0, j1, j2]
    # action shape is [j0, j1, j2]
    assert len(data["states_tensor"]) == 3
    assert len(data["actions_tensor"]) == 3
    
    # Frame 0: J0=0.0, J1=45.0, J2=90.0
    # J1 in radians = 45 * pi/180 = 0.785398...
    # J2 in radians = 90 * pi/180 = 1.570796...
    assert data["states_tensor"][0][0] == 0.0  # pos_x
    assert abs(data["states_tensor"][0][4] - 0.785398163) < 1e-4  # r1 (J1 rad)
    assert abs(data["states_tensor"][0][5] - 1.570796327) < 1e-4  # r2 (J2 rad)
    assert data["states_tensor"][0][6] == 0.0  # J0
    assert data["states_tensor"][0][7] == 45.0 # J1
    assert data["states_tensor"][0][8] == 90.0 # J2
    
    assert data["actions_tensor"][0] == [0.0, 45.0, 90.0]

def test_isaac_exporter_empty(temp_dir):
    exporter = IsaacExporter()
    usd_path = temp_dir / "empty.usda"
    
    success = exporter.export([], str(usd_path), format_type="usd")
    assert success is True
    content = usd_path.read_text(encoding="utf-8")
    assert "#usda 1.0" in content
