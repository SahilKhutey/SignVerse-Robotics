import json
import math
import os

class IsaacExporter:
    """
    Isaac Simulation Exporter.
    Generates USD hierarchies (for Omniverse/Isaac Sim) and state-action tensor datasets
    (for Isaac Gym reinforcement learning pipelines).
    """
    def export(self, motion_sequence, path, format_type=None):
        """
        Exports a motion sequence (list of frames) to either USD (USDA) or JSON tensor format,
        and saves it to the specified path.
        """
        if format_type is None:
            if path.lower().endswith(".usd") or path.lower().endswith(".usda"):
                format_type = "usd"
            else:
                format_type = "json"

        if format_type.lower() in ("usd", "usda"):
            content = self.export_usd(motion_sequence)
        elif format_type.lower() == "json":
            content = self.export_json(motion_sequence)
        else:
            raise ValueError(f"Unsupported format: {format_type}. Must be 'usd' or 'json'.")

        # Ensure directory structure exists
        dir_name = os.path.dirname(os.path.abspath(path))
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True

    def export_usd(self, motion_sequence):
        """
        Generates a standard hierarchical USDA file with timecoded frame samples.
        """
        if not motion_sequence:
            return "#usda 1.0\ndef Xform \"World\" {\n}\n"

        usd_header = (
            "#usda 1.0\n"
            "(\n"
            "    doc = \"SignVerse Robotics Simulation Export\"\n"
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
        rotate_j2_samples = []

        for idx, frame in enumerate(motion_sequence):
            time_step = float(idx + 1)
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", 0.0)
            j1 = joints.get("J1", 0.0)
            j2 = joints.get("J2", 0.0)

            translate_samples.append(f"            {time_step}: ({trans[0]:.4f}, {trans[1]:.4f}, {trans[2]:.4f})")
            rotate_j0_samples.append(f"            {time_step}: ({j0:.4f}, 0, 0)")
            rotate_j1_samples.append(f"            {time_step}: (0, {j1:.4f}, 0)")
            rotate_j2_samples.append(f"            {time_step}: (0, 0, {j2:.4f})")

        usd_header += "        double3 xformOp:translate.timeSamples = {\n" + ",\n".join(translate_samples) + "\n        }\n"
        usd_header += "        uniform token[] xformOpOrder = [\"xformOp:translate\"]\n"
        usd_header += "        def Xform \"Link0\"\n"
        usd_header += "        {\n"
        usd_header += "            double3 xformOp:rotateXYZ.timeSamples = {\n" + ",\n".join(rotate_j0_samples) + "\n            }\n"
        usd_header += "            uniform token[] xformOpOrder = [\"xformOp:rotateXYZ\"]\n"
        usd_header += "            def Xform \"Link1\"\n"
        usd_header += "            {\n"
        usd_header += "                double3 xformOp:rotateXYZ.timeSamples = {\n" + ",\n".join(rotate_j1_samples) + "\n                }\n"
        usd_header += "                uniform token[] xformOpOrder = [\"xformOp:rotateXYZ\"]\n"
        usd_header += "                def Xform \"Link2\"\n"
        usd_header += "                {\n"
        usd_header += "                    double3 xformOp:rotateXYZ.timeSamples = {\n" + ",\n".join(rotate_j2_samples) + "\n                    }\n"
        usd_header += "                    uniform token[] xformOpOrder = [\"xformOp:rotateXYZ\"]\n"
        usd_header += "                }\n"
        usd_header += "            }\n"
        usd_header += "        }\n"
        usd_header += "    }\n"
        usd_header += "}\n"

        return usd_header

    def export_json(self, motion_sequence):
        """
        Generates Isaac Gym compatible joint training tensors.
        """
        states_tensor = []
        actions_tensor = []

        for frame in motion_sequence:
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", 0.0)
            j1 = joints.get("J1", 0.0)
            j2 = joints.get("J2", 0.0)

            # Map positions and Euler angles (degrees to radians)
            pos_x, pos_y, pos_z = trans
            r0 = math.radians(j0)
            r1 = math.radians(j1)
            r2 = math.radians(j2)

            # Observation vector: [pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, j0, j1, j2]
            state = [pos_x, pos_y, pos_z, r0, r1, r2, j0, j1, j2]
            # Control action vector: [j0, j1, j2]
            action = [j0, j1, j2]

            states_tensor.append(state)
            actions_tensor.append(action)

        isaac_data = {
            "metadata": {
                "num_frames": len(motion_sequence),
                "frequency_hz": 30,
                "robot_type": "3d_arm",
                "joint_names": ["J0", "J1", "J2"],
                "joint_limits": {
                    "J0": [0.0, 180.0],
                    "J1": [20.0, 160.0],
                    "J2": [0.0, 180.0]
                },
                "stiffness": [400.0, 400.0, 400.0],
                "damping": [40.0, 40.0, 40.0]
            },
            "states_tensor": states_tensor,
            "actions_tensor": actions_tensor
        }
        return json.dumps(isaac_data, indent=2)
