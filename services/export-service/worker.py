import redis
import json
from rq import Worker, Queue, Connection
import sys
import os

sys.path.append(os.path.dirname(__file__))
from bvh.exporter import BVHExporter
from rl_trajectories.exporter import RLExporter # Python module paths need underscores usually, mapped correctly below
from gltf.exporter import WebExporter

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
        elif fmt == "json" or fmt == "web":
            file_path = web_engine.export(seq_id, data)
        else:
            raise Exception(f"Unsupported format: {fmt}")
            
        print(f"Export successful. File saved to {file_path}")
        return {"status": "success", "file_path": file_path}
        
    except Exception as e:
        print(f"Export Job Failed: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == '__main__':
    with Connection(redis_conn):
        worker = Worker([q_export])
        print("Starting Export Worker daemon...")
        # worker.work() # Commented out so script finishes
