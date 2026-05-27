import cv2
import os

def extract_frames(
    video_path,
    output_dir
):

    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)

    frame_index = 0

    while True:

        success, frame = cap.read()

        if not success:
            break

        frame_path = f"{output_dir}/{frame_index:06d}.jpg"

        cv2.imwrite(frame_path, frame)

        frame_index += 1

    cap.release()

    return frame_index
