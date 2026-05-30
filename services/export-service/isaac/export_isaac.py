import os

def generate_usd(sequence_id, kinematics_data, output_dir="exports/usd"):
    '''
    Exports Universal Scene Description (USD) file with time-sampled translations and joint angles.
    '''
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"{sequence_id}.usd")
    
    if not kinematics_data:
        usd_content = "#usda 1.0\ndef Xform \"World\" {\n}\n"
    else:
        usd_content = (
            "#usda 1.0\n"
            "(\n"
            "    doc = \"SignVerse Robotics Simulation USD Export\"\n"
            "    metersPerUnit = 1.0\n"
            "    upAxis = \"Z\"\n"
            ")\n"
            "def Xform \"World\"\n"
            "{\n"
            "    def Xform \"RobotPelvis\"\n"
            "    {\n"
        )
        
        translate_samples = []
        rotate_j0_samples = []
        rotate_j1_samples = []
        
        for idx, frame in enumerate(kinematics_data):
            time_step = float(idx + 1)
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", joints.get("shoulder_pitch_r", 0.0))
            j1 = joints.get("J1", joints.get("shoulder_roll_r", 0.0))
            
            translate_samples.append(f"            {time_step}: ({trans[0]:.4f}, {trans[1]:.4f}, {trans[2]:.4f})")
            rotate_j0_samples.append(f"            {time_step}: ({j0:.4f}, 0, 0)")
            rotate_j1_samples.append(f"            {time_step}: (0, {j1:.4f}, 0)")
            
        usd_content += "        double3 xformOp:translate.timeSamples = {\n" + ",\n".join(translate_samples) + "\n        }\n"
        usd_content += "        uniform token[] xformOpOrder = [\"xformOp:translate\"]\n"
        usd_content += "        def Xform \"Link0\"\n"
        usd_content += "        {\n"
        usd_content += "            double3 xformOp:rotateXYZ.timeSamples = {\n" + ",\n".join(rotate_j0_samples) + "\n            }\n"
        usd_content += "            uniform token[] xformOpOrder = [\"xformOp:rotateXYZ\"]\n"
        usd_content += "            def Xform \"Link1\"\n"
        usd_content += "            {\n"
        usd_content += "                double3 xformOp:rotateXYZ.timeSamples = {\n" + ",\n".join(rotate_j1_samples) + "\n                }\n"
        usd_content += "                uniform token[] xformOpOrder = [\"xformOp:rotateXYZ\"]\n"
        usd_content += "            }\n"
        usd_content += "        }\n"
        usd_content += "    }\n"
        usd_content += "}\n"
        
    with open(file_path, "w") as f:
        f.write(usd_content)
        
    return file_path
