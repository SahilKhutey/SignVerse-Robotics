# Perception Pipeline

The Perception daemon utilizes headless OpenCV and MediaPipe Holistic. 
When multiple people are detected in a single frame, the system utilizes `YOLO` bounding boxes coupled with `ByteTrack` to assign persistent tracking IDs across occlusions.
