PIPELINE_PRESETS = {
    "fast_pose": {"perception": "mediapipe_light", "retargeting": False},
    "high_quality": {"perception": "yolo+smpl", "retargeting": True},
    "robotics": {"perception": "mediapipe_fullbody", "retargeting": True},
    "cinematic": {"perception": "smpl-x", "export": "fbx"}
}
