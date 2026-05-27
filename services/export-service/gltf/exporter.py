import os
import json

class WebExporter:
    def __init__(self, output_dir="exports/web"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def export(self, sequence_id, kinematics_data):
        '''
        Exports a compressed JSON format optimized for React-Three-Fiber consumption.
        '''
        file_path = os.path.join(self.output_dir, f"{sequence_id}.json")
        
        web_payload = {
            "id": sequence_id,
            "version": "1.0",
            "tracks": kinematics_data # List of frames
        }
        
        with open(file_path, "w") as f:
            json.dump(web_payload, f, separators=(',', ':')) # Compress JSON
            
        return file_path
