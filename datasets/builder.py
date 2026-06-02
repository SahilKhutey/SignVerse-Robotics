import os
import json
import numpy as np
import torch
from torch.utils.data import Dataset
from pathlib import Path
import importlib.util

# Resolve repository root to dynamically load hyphenated modules
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent

def _import_motion_format():
    svmf_path = REPO_ROOT / "packages" / "motion-format" / "svmf.py"
    comp_path = REPO_ROOT / "packages" / "motion-format" / "compression.py"
    
    spec_svmf = importlib.util.spec_from_file_location("svmf", str(svmf_path))
    svmf_mod = importlib.util.module_from_spec(spec_svmf)
    spec_svmf.loader.exec_module(svmf_mod)
    
    spec_comp = importlib.util.spec_from_file_location("compression", str(comp_path))
    comp_mod = importlib.util.module_from_spec(spec_comp)
    spec_comp.loader.exec_module(comp_mod)
    
    return svmf_mod.SVMFExporter, comp_mod.compress_motion_sequence

def build_dataset(output_dir, dataset_id, metadata, sequences, objects, skills, generate_svmf=True):
    """
    Packages metadata, coordinate sequences, object interactions, and skill tags
    into structured files (JSON and compressed NPZ formats). Also generates SVMF-compliant
    JSON logs and delta-compressed packages.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Save metadata index
    index_payload = {
        "dataset_id": dataset_id,
        "metadata": metadata,
        "objects": objects,
        "skills": skills,
        "sequences_count": len(sequences)
    }
    
    json_path = os.path.join(output_dir, f"{dataset_id}_manifest.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(index_payload, f, indent=2)
        
    # 2. Package coordinate sequences into NPZ
    npz_data = {}
    for i, seq in enumerate(sequences):
        seq_id = seq.get("sequence_id", f"seq_{i}")
        frames = seq.get("frames", [])
        
        # Convert frames to numpy float32 array
        frame_arrays = []
        for f in frames:
            joints_data = []
            for joint_name, j_val in f.get("joints", {}).items():
                if isinstance(j_val, dict):
                    joints_data.extend([
                        j_val.get("x", 0.0),
                        j_val.get("y", 0.0),
                        j_val.get("z", 0.0),
                        j_val.get("confidence", 0.0)
                    ])
                else:
                    joints_data.extend([j_val, 0.0, 0.0, 0.0])
            frame_arrays.append(joints_data)
            
        npz_data[seq_id] = np.array(frame_arrays, dtype=np.float32)
        
    npz_path = os.path.join(output_dir, f"{dataset_id}_sequences.npz")
    np.savez_compressed(npz_path, **npz_data)
    
    # 3. Generate SVMF Logs
    if generate_svmf:
        svmf_dir = os.path.join(output_dir, "svmf")
        os.makedirs(svmf_dir, exist_ok=True)
        try:
            SVMFExporter, compress_motion_sequence = _import_motion_format()
            for i, seq in enumerate(sequences):
                seq_id = seq.get("sequence_id", f"seq_{i}")
                
                skeleton_graph = seq.get("skeleton_graph", {"nodes": ["pelvis", "spine", "neck"]})
                
                # Check for existing joint_angles list or compile from coordinate frames
                joint_angles = seq.get("joint_angles", {})
                if not joint_angles:
                    joint_angles = {"J0": [], "J1": [], "J2": []}
                    for f in seq.get("frames", []):
                        j_map = f.get("joints", {})
                        # Extract x,y,z if dict or value if float
                        def get_val(j, key="x"):
                            val = j_map.get(j, 0.0)
                            return val.get(key, 0.0) if isinstance(val, dict) else val
                        joint_angles["J0"].append(get_val("J0", "x"))
                        joint_angles["J1"].append(get_val("J1", "y"))
                        joint_angles["J2"].append(get_val("J2", "z"))
                
                velocities = seq.get("velocities", {})
                if not velocities:
                    length = len(seq.get("frames", []))
                    velocities = {"J0": [0.0] * length, "J1": [0.0] * length, "J2": [0.0] * length}
                    
                actions = seq.get("actions", {"skills": list(skills.keys()) if isinstance(skills, dict) else list(skills)})
                interactions = seq.get("interactions", {"objects": objects})
                embeddings = seq.get("embeddings", {"embedding": [0.0] * 128})
                
                # Validate using Pydantic via Exporter
                svmf_payload = SVMFExporter.build_payload(
                    skeleton_graph=skeleton_graph,
                    joint_angles=joint_angles,
                    velocities=velocities,
                    actions=actions,
                    interactions=interactions,
                    embeddings=embeddings
                )
                
                svmf_file = os.path.join(svmf_dir, f"{seq_id}.svmf.json")
                with open(svmf_file, "w", encoding="utf-8") as sf:
                    json.dump(svmf_payload, sf, indent=2)
                    
                # Export keyframe decimated delta compressed version
                try:
                    comp_frames = []
                    translation_list = seq.get("translation", [[0.0, 0.0, 0.0]] * len(seq.get("frames", [])))
                    num_frames = len(seq.get("frames", []))
                    for idx in range(num_frames):
                        frame_joints = {}
                        for k, v in joint_angles.items():
                            if isinstance(v, list) and idx < len(v):
                                frame_joints[k] = v[idx]
                            else:
                                frame_joints[k] = 0.0
                        comp_frames.append({
                            "translation": translation_list[idx] if idx < len(translation_list) else [0.0, 0.0, 0.0],
                            "joints": frame_joints
                        })
                    
                    compressed = compress_motion_sequence(comp_frames, tolerance=0.01)
                    comp_file = os.path.join(svmf_dir, f"{seq_id}_compressed.svmf.json")
                    with open(comp_file, "w", encoding="utf-8") as cf:
                        json.dump(compressed, cf, indent=2)
                except Exception:
                    pass
        except Exception:
            pass
            
    return {
        "manifest": json_path,
        "archive": npz_path
    }

class SVMFDataset(Dataset):
    """
    A PyTorch Dataset that loads SVMF JSON logs directly for policy/behavior cloning training.
    """
    def __init__(self, svmf_dir_or_files, normalise=True, input_dim=63, output_dim=3):
        self.samples = []
        self.normalise = normalise
        self.input_dim = input_dim
        self.output_dim = output_dim
        
        self._obs_mean = None
        self._obs_std = None
        
        files = []
        if isinstance(svmf_dir_or_files, (str, Path)):
            p = Path(svmf_dir_or_files)
            if p.is_dir():
                files = list(p.glob("*.svmf.json"))
            elif p.is_file():
                files = [p]
        else:
            files = [Path(f) for f in svmf_dir_or_files]
            
        for f in files:
            # Skip compressed versions
            if f.name.endswith("_compressed.svmf.json"):
                continue
            try:
                with open(f, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                
                joint_angles = data.get("joint_angles", {})
                keys = sorted(joint_angles.keys())
                if not keys:
                    continue
                    
                num_frames = min(len(joint_angles[k]) for k in keys if isinstance(joint_angles[k], list))
                for idx in range(num_frames):
                    obs = [joint_angles[k][idx] for k in keys]
                    if len(obs) < self.input_dim:
                        obs += [0.0] * (self.input_dim - len(obs))
                    else:
                        obs = obs[:self.input_dim]
                        
                    lbl = [joint_angles[k][idx] for k in keys[:self.output_dim]]
                    if len(lbl) < self.output_dim:
                        lbl += [0.0] * (self.output_dim - len(lbl))
                    else:
                        lbl = lbl[:self.output_dim]
                        
                    self.samples.append((np.array(obs, dtype=np.float32), np.array(lbl, dtype=np.float32)))
            except Exception:
                continue
                
        if self.normalise and len(self.samples) > 0:
            obs_stack = np.stack([s[0] for s in self.samples], axis=0)
            self._obs_mean = obs_stack.mean(axis=0)
            self._obs_std = obs_stack.std(axis=0) + 1e-8
            
    def __len__(self):
        return len(self.samples)
        
    def __getitem__(self, idx):
        obs, label = self.samples[idx]
        if self.normalise and self._obs_mean is not None:
            obs = (obs - self._obs_mean) / self._obs_std
        return (
            torch.tensor(obs, dtype=torch.float32),
            torch.tensor(label, dtype=torch.float32)
        )

