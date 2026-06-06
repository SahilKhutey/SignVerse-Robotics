import cv2
import os
from pathlib import Path


SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
MONOREPO_ROOT = os.path.abspath(os.path.join(SERVICE_DIR, "..", ".."))
DEFAULT_FRAME_ROOT = os.path.join(MONOREPO_ROOT, "core", "datasets", "raw_uploads", "frames")


def _default_output_dir(video_path):
    stem = Path(video_path).stem or "video"
    return os.path.join(DEFAULT_FRAME_ROOT, stem)


def extract_frames(video_path, output_dir=None, max_frames=None, stride=1):
    output_dir = output_dir or _default_output_dir(video_path)
    if max_frames is None:
        max_frames = int(os.getenv("SIGNVERSE_INGEST_MAX_FRAMES", "300"))
    stride = max(1, int(stride or os.getenv("SIGNVERSE_INGEST_FRAME_STRIDE", "1")))

    os.makedirs(output_dir, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Unable to open video for frame extraction: {video_path}")

    frame_count = 0
    saved_count = 0
    frame_paths = []
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % stride == 0:
            frame_path = os.path.join(output_dir, f"frame_{saved_count:04d}.jpg")
            cv2.imwrite(frame_path, frame)
            frame_paths.append(frame_path)
            saved_count += 1
            if max_frames and saved_count >= max_frames:
                break
        frame_count += 1
        
    cap.release()
    return frame_paths
