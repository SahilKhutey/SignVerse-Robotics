import os
from core.robotics.simulation.isaac_exporter import IsaacExporter

def generate_usd(sequence_id, kinematics_data, output_dir="exports/usd"):
    """
    Exports Universal Scene Description (USD) file by delegating to core IsaacExporter.
    """
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"{sequence_id}.usd")
    exporter = IsaacExporter()
    exporter.export(kinematics_data, file_path, format_type="usd")
    return file_path

