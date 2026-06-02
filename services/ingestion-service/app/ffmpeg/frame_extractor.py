import cv2
import os
import numpy as np

def stabilize_frame(frame, prev_frame):
    if prev_frame is None:
        return frame
    try:
        # Convert to grayscale
        gray_curr = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_prev = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        # Find translation using Phase Correlation (fast and robust)
        shift, _ = cv2.phaseCorrelate(gray_curr.astype(np.float32), gray_prev.astype(np.float32))
        dx, dy = shift
        # Restrict shift to avoid extreme warps
        if abs(dx) < 30 and abs(dy) < 30:
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            return cv2.warpAffine(frame, M, (frame.shape[1], frame.shape[0]))
    except Exception:
        pass
    return frame

def extract_frames(
    video_path,
    output_dir,
    target_size=(640, 480),
    denoise=True,
    stabilize=True
):
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    frame_index = 0
    prev_frame = None

    while True:
        success, frame = cap.read()
        if not success:
            break

        # 1. Resize (Bilinear Interpolation)
        if target_size:
            frame = cv2.resize(frame, target_size, interpolation=cv2.INTER_LINEAR)

        # 2. Gaussian Denoising
        if denoise:
            frame = cv2.GaussianBlur(frame, (3, 3), 0)

        # 3. Stabilization
        if stabilize:
            stabilized = stabilize_frame(frame, prev_frame)
            prev_frame = frame.copy()
            frame = stabilized
        else:
            prev_frame = frame.copy()

        frame_path = f"{output_dir}/{frame_index:06d}.jpg"
        cv2.imwrite(frame_path, frame)
        frame_index += 1

    cap.release()
    return frame_index
