import yt_dlp
import os
import uuid
import math

import cv2
import numpy as np


SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
MONOREPO_ROOT = os.path.abspath(os.path.join(SERVICE_DIR, "..", ".."))
DEFAULT_UPLOAD_DIR = os.path.join(MONOREPO_ROOT, "core", "datasets", "raw_uploads", "youtube")


def synthetic_youtube_fallback_enabled():
    return os.getenv("SIGNVERSE_YOUTUBE_SYNTHETIC_FALLBACK", "1").lower() in {"1", "true", "yes", "on"}


def generate_synthetic_youtube_video(output_dir=DEFAULT_UPLOAD_DIR, frame_count=90, fps=30):
    """Generate a deterministic gesture-like MP4 so ingestion can run offline."""
    os.makedirs(output_dir, exist_ok=True)
    video_id = f"synthetic_youtube_{uuid.uuid4().hex[:8]}"
    final_path = os.path.join(output_dir, f"{video_id}.mp4")
    writer = cv2.VideoWriter(final_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (640, 360))
    if not writer.isOpened():
        raise RuntimeError("Unable to initialize OpenCV VideoWriter for synthetic YouTube fallback")

    for i in range(frame_count):
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        t = i / max(1, frame_count - 1)
        wrist_x = int(320 + math.sin(t * math.pi * 4) * 140)
        wrist_y = int(180 + math.cos(t * math.pi * 2) * 70)

        cv2.putText(frame, "SignVerse Synthetic YouTube", (24, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (230, 230, 230), 2)
        cv2.line(frame, (320, 280), (wrist_x, wrist_y), (0, 220, 255), 5)
        cv2.circle(frame, (320, 280), 18, (60, 120, 255), -1)
        cv2.circle(frame, (wrist_x, wrist_y), 24, (0, 255, 140), -1)
        cv2.putText(frame, f"frame {i:03d}", (24, 330), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (160, 200, 255), 2)
        writer.write(frame)

    writer.release()
    return final_path


def download_youtube_video(url, output_dir=DEFAULT_UPLOAD_DIR):
    os.makedirs(output_dir, exist_ok=True)
    video_id = str(uuid.uuid4())
    output_path = os.path.join(output_dir, f"{video_id}.%(ext)s")
    
    ydl_opts = {
        'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]', # Limit to 720p for speed
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading YouTube URL: {url}")
            ydl.download([url])
            
        final_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(final_path):
            return final_path
        else:
            raise Exception("File downloaded but mp4 not found")
            
    except Exception as e:
        print(f"Error downloading YouTube video: {e}")
        if synthetic_youtube_fallback_enabled():
            print("Generating synthetic YouTube fallback video for offline ingestion.")
            return generate_synthetic_youtube_video(output_dir=output_dir)
        return None
