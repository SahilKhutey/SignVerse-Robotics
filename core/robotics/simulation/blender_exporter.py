import math
import os

class BlenderExporter:
    """
    Blender Motion Exporter.
    Generates standard BVH and minimal FBX ASCII skeleton animations
    representing the 3D robotic arm motion trajectories.
    """
    def export(self, motion_sequence, path, format_type=None):
        """
        Exports a motion sequence (list of frames) to either BVH or FBX ASCII format,
        and saves the output to the specified path.
        """
        if format_type is None:
            if path.lower().endswith(".fbx"):
                format_type = "fbx"
            else:
                format_type = "bvh"

        if format_type.lower() == "bvh":
            content = self.export_bvh(motion_sequence)
        elif format_type.lower() == "fbx":
            content = self.export_fbx_ascii(motion_sequence)
        else:
            raise ValueError(f"Unsupported format: {format_type}. Must be 'bvh' or 'fbx'.")

        # Ensure directory structure exists
        dir_name = os.path.dirname(os.path.abspath(path))
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True

    def export_bvh(self, motion_sequence):
        """
        Converts the motion sequence into a standard hierarchical BVH structure.
        """
        if not motion_sequence:
            return "HIERARCHY\nROOT Pelvis\n{\n}\nMOTION\nFrames: 0\nFrame Time: 0.033333\n"

        frames_count = len(motion_sequence)
        hierarchy = (
            "HIERARCHY\n"
            "ROOT Pelvis\n"
            "{\n"
            "  OFFSET 0.0 0.0 0.0\n"
            "  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation\n"
            "  JOINT Joint0\n"
            "  {\n"
            "    OFFSET 0.0 0.2 0.0\n"
            "    CHANNELS 3 Zrotation Yrotation Xrotation\n"
            "    JOINT Joint1\n"
            "    {\n"
            "      OFFSET 0.0 0.4 0.0\n"
            "      CHANNELS 3 Zrotation Yrotation Xrotation\n"
            "      JOINT Joint2\n"
            "      {\n"
            "        OFFSET 0.0 0.3 0.0\n"
            "        CHANNELS 3 Zrotation Yrotation Xrotation\n"
            "        End Site\n"
            "        {\n"
            "          OFFSET 0.0 0.2 0.0\n"
            "        }\n"
            "      }\n"
            "    }\n"
            "  }\n"
            "}\n"
        )

        motion = f"MOTION\nFrames: {frames_count}\nFrame Time: 0.033333\n"
        for frame in motion_sequence:
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", 0.0)
            j1 = joints.get("J1", 0.0)
            j2 = joints.get("J2", 0.0)
            frame_line = f"{trans[0]:.6f} {trans[1]:.6f} {trans[2]:.6f} 0.0 0.0 0.0 {j0:.6f} 0.0 0.0 {j1:.6f} 0.0 0.0 {j2:.6f} 0.0 0.0\n"
            motion += frame_line
        return hierarchy + motion

    def export_fbx_ascii(self, motion_sequence):
        """
        Converts the motion sequence into a minimal, valid ASCII FBX format.
        """
        if not motion_sequence:
            return "; FBX ASCII Export\n"

        frames_count = len(motion_sequence)

        # FBX Ticks: 1 second = 46,186,242,000 ticks.
        # At 30 FPS, frame interval = 1,539,541,400 ticks.
        time_ticks = [i * 1539541400 for i in range(frames_count)]
        time_str = ",".join(str(t) for t in time_ticks)

        # Extract translation curves and joint rotations
        tx_vals, ty_vals, tz_vals = [], [], []
        j0_vals, j1_vals, j2_vals = [], [], []

        for frame in motion_sequence:
            trans = frame.get("translation", [0.0, 0.0, 0.0])
            joints = frame.get("joints", {})
            j0 = joints.get("J0", 0.0)
            j1 = joints.get("J1", 0.0)
            j2 = joints.get("J2", 0.0)

            tx_vals.append(trans[0])
            ty_vals.append(trans[1])
            tz_vals.append(trans[2])
            j0_vals.append(j0)
            j1_vals.append(j1)
            j2_vals.append(j2)

        tx_str = ",".join(f"{v:.6f}" for v in tx_vals)
        ty_str = ",".join(f"{v:.6f}" for v in ty_vals)
        tz_str = ",".join(f"{v:.6f}" for v in tz_vals)
        j0_str = ",".join(f"{v:.6f}" for v in j0_vals)
        j1_str = ",".join(f"{v:.6f}" for v in j1_vals)
        j2_str = ",".join(f"{v:.6f}" for v in j2_vals)

        fbx_content = f"""; FBX 7.4.0 project file
; Created by SignVerse Robotics OS Exporter
; ----------------------------------------------------

FBXHeaderExtension:  {{
    FBXHeaderVersion: 1003
    FBXVersion: 7400
}}

GlobalSettings:  {{
    Version: 1000
    Properties70:  {{
        P: "UpAxis", "int", "Integer", "",2
        P: "UpAxisSign", "int", "Integer", "",1
        P: "FrontAxis", "int", "Integer", "",1
        P: "FrontAxisSign", "int", "Integer", "",-1
        P: "CoordAxis", "int", "Integer", "",0
        P: "CoordAxisSign", "int", "Integer", "",1
        P: "OriginalUpAxis", "int", "Integer", "",2
        P: "OriginalUpAxisSign", "int", "Integer", "",1
        P: "UnitScaleFactor", "double", "Number", "",1
        P: "OriginalUnitScaleFactor", "double", "Number", "",1.0
    }}
}}

Documents:  {{
    Count: 1
    Document: 123456789, "", "Scene"
}}

References:  {{
}}

Definitions:  {{
    Version: 100
    Count: 15
    ObjectType: "Model" {{
        Count: 5
    }}
    ObjectType: "AnimationStack" {{
        Count: 1
    }}
    ObjectType: "AnimationLayer" {{
        Count: 1
    }}
    ObjectType: "AnimationCurveNode" {{
        Count: 4
    }}
    ObjectType: "AnimationCurve" {{
        Count: 6
    }}
}}

Objects:  {{
    Model: 1001, "Model::Pelvis", "LimbNode" {{
        Version: 232
        Properties70:  {{
            P: "RotationActive", "bool", "", "",1
            P: "InheritType", "enum", "", "",1
            P: "ScalingMax", "double3", "Color", "",1,1,1
        }}
    }}
    Model: 1002, "Model::Joint0", "LimbNode" {{
        Version: 232
        Properties70:  {{
            P: "RotationActive", "bool", "", "",1
            P: "InheritType", "enum", "", "",1
            P: "Lcl Translation", "Lcl Translation", "", "A",0,0.2,0
        }}
    }}
    Model: 1003, "Model::Joint1", "LimbNode" {{
        Version: 232
        Properties70:  {{
            P: "RotationActive", "bool", "", "",1
            P: "InheritType", "enum", "", "",1
            P: "Lcl Translation", "Lcl Translation", "", "A",0,0.4,0
        }}
    }}
    Model: 1004, "Model::Joint2", "LimbNode" {{
        Version: 232
        Properties70:  {{
            P: "RotationActive", "bool", "", "",1
            P: "InheritType", "enum", "", "",1
            P: "Lcl Translation", "Lcl Translation", "", "A",0,0.3,0
        }}
    }}
    
    AnimationStack: 2001, "AnimStack::ArmAnim", "" {{
        Version: 100
    }}
    
    AnimationLayer: 2002, "AnimLayer::BaseLayer", "" {{
        Version: 100
    }}
    
    ; Animation Curve Nodes
    AnimationCurveNode: 3001, "AnimCurveNode::Translation", "" {{
        Properties70:  {{
            P: "d", "Compound", "", ""
        }}
    }}
    AnimationCurveNode: 3002, "AnimCurveNode::Rotation_J0", "" {{
        Properties70:  {{
            P: "d", "Compound", "", ""
        }}
    }}
    AnimationCurveNode: 3003, "AnimCurveNode::Rotation_J1", "" {{
        Properties70:  {{
            P: "d", "Compound", "", ""
        }}
    }}
    AnimationCurveNode: 3004, "AnimCurveNode::Rotation_J2", "" {{
        Properties70:  {{
            P: "d", "Compound", "", ""
        }}
    }}
    
    ; Animation Curves
    AnimationCurve: 4001, "AnimCurve::T_X", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {tx_str} }}
    }}
    AnimationCurve: 4002, "AnimCurve::T_Y", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {ty_str} }}
    }}
    AnimationCurve: 4003, "AnimCurve::T_Z", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {tz_str} }}
    }}
    AnimationCurve: 4004, "AnimCurve::R_J0_X", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {j0_str} }}
    }}
    AnimationCurve: 4005, "AnimCurve::R_J1_Y", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {j1_str} }}
    }}
    AnimationCurve: 4006, "AnimCurve::R_J2_Z", "" {{
        KeyTime: *{frames_count} {{ {time_str} }}
        KeyValueFloat: *{frames_count} {{ {j2_str} }}
    }}
}}

Connections:  {{
    ; Parent-Child connections
    C: "OO", 1002, 1001
    C: "OO", 1003, 1002
    C: "OO", 1004, 1003
    
    ; Link AnimStack and AnimLayer
    C: "OO", 2002, 2001
    
    ; Link CurveNodes to Models
    C: "OP", 3001, 1001, "Lcl Translation"
    C: "OP", 3002, 1002, "Lcl Rotation"
    C: "OP", 3003, 1003, "Lcl Rotation"
    C: "OP", 3004, 1004, "Lcl Rotation"
    
    ; Link Curves to CurveNodes
    C: "OP", 4001, 3001, "d|X"
    C: "OP", 4002, 3001, "d|Y"
    C: "OP", 4003, 3001, "d|Z"
    C: "OP", 4004, 3002, "d|X"
    C: "OP", 4005, 3003, "d|Y"
    C: "OP", 4006, 3004, "d|Z"
}}
""";
        return fbx_content
