import redis
import json
from rq import Worker, Queue
import sys
import os
import importlib.util

sys.path.append(os.path.dirname(__file__))
from bvh.exporter import BVHExporter
from rl_trajectories.exporter import RLExporter 
from gltf.exporter import WebExporter
from isaac.export_isaac import generate_usd

# Load local mujoco XML generator dynamically to avoid collision with global 'mujoco' python package
spec_mujoco = importlib.util.spec_from_file_location(
    "mujoco_export", 
    os.path.join(os.path.dirname(__file__), "mujoco/export_mujoco.py")
)
mujoco_export = importlib.util.module_from_spec(spec_mujoco)
spec_mujoco.loader.exec_module(mujoco_export)
generate_mujoco_xml = mujoco_export.generate_mujoco_xml

redis_conn = redis.Redis(host='localhost', port=6379)
q_export = Queue('export', connection=redis_conn)

# Initialize engines
bvh_engine = BVHExporter()
rl_engine = RLExporter()
web_engine = WebExporter()

def process_export_job(payload_json):
    '''
    Active daemon listening for export commands.
    payload format: {"sequence_id": "123", "format": "bvh", "data": [...]}
    '''
    try:
        req = json.loads(payload_json)
        seq_id = req.get("sequence_id", "unknown")
        fmt = req.get("format", "bvh").lower()
        data = req.get("data", [])
        
        print(f"Executing Export Job: {seq_id} -> .{fmt}")
        
        file_path = None
        if fmt == "bvh":
            file_path = bvh_engine.export(seq_id, data)
        elif fmt == "npy" or fmt == "rl":
            file_path = rl_engine.export(seq_id, data)
        elif fmt == "json" or fmt == "web" or fmt == "gltf":
            file_path = web_engine.export(seq_id, data)
        elif fmt == "usd":
            file_path = generate_usd(seq_id, data)
        elif fmt == "xml" or fmt == "mujoco":
            robot_profile = {"robot_name": seq_id}
            xml_str = generate_mujoco_xml(robot_profile)
            output_dir = "exports/mujoco"
            os.makedirs(output_dir, exist_ok=True)
            file_path = os.path.join(output_dir, f"{seq_id}.xml")
            with open(file_path, "w") as f:
                f.write(xml_str)
        elif fmt == "fbx":
            output_dir = "exports/fbx"
            os.makedirs(output_dir, exist_ok=True)
            file_path = os.path.join(output_dir, f"{seq_id}.fbx")
            try:
                from blender.automation import automate_blender_retargeting
                bvh_file = bvh_engine.export(seq_id, data)
                automate_blender_retargeting(bvh_file, file_path)
            except Exception as e:
                print(f"Blender/bpy background automation bypassed/failed: {e}")
                print("Falling back to native core BlenderExporter for ASCII FBX.")
                from core.robotics.simulation.blender_exporter import BlenderExporter
                BlenderExporter().export(data, file_path, format_type="fbx")
        else:
            raise Exception(f"Unsupported format: {fmt}")
            
        print(f"Export successful. File saved to {file_path}")
        return {"status": "success", "file_path": file_path}
        
    except Exception as e:
        print(f"Export Job Failed: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == '__main__':
    worker = Worker([q_export], connection=redis_conn)
    print("Starting Export Worker daemon...")
    # worker.work() # Commented out so script finishes
