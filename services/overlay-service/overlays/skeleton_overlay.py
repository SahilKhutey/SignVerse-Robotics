import cv2
from .bones import BONES

def draw_skeleton(frame, landmarks):
    for point in landmarks:
        x = int(point["x"] * frame.shape[1])
        y = int(point["y"] * frame.shape[0])
        cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)
    return frame

def draw_bones(frame, landmarks):
    for start, end in BONES:
        if start < len(landmarks) and end < len(landmarks):
            x1 = int(landmarks[start]["x"] * frame.shape[1])
            y1 = int(landmarks[start]["y"] * frame.shape[0])
            x2 = int(landmarks[end]["x"] * frame.shape[1])
            y2 = int(landmarks[end]["y"] * frame.shape[0])
            cv2.line(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
    return frame
