import os
from core.robotics.simulation.blender_exporter import BlenderExporter

class BVHExporter:
    def __init__(self, output_dir="exports/bvh"):
        self.output_dir = output_dir
        self.exporter = BlenderExporter()
        os.makedirs(self.output_dir, exist_ok=True)
        
    def export(self, sequence_id, kinematics_data, fps=30):
        """
        Generates a strict .bvh text file by delegating to core BlenderExporter.
        """
        file_path = os.path.join(self.output_dir, f"{sequence_id}.bvh")
        self.exporter.export(kinematics_data, file_path, format_type="bvh")
        return file_path

