import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. High-Performance FFMPEG Extraction
write_file("services/ingestion-service/ffmpeg/extractor.py", """import subprocess
import os

class FFMPEGExtractor:
    def __init__(self, output_dir="uploads/frames"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def extract(self, video_path, target_fps=30):
        '''
        Uses a raw FFMPEG subprocess to rip frames immensely faster than cv2.VideoCapture.
        Automatically normalizes the FPS during extraction.
        '''
        output_pattern = os.path.join(self.output_dir, "frame_%04d.jpg")
        
        command = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f'fps={target_fps}',
            '-qscale:v', '2', # High quality jpeg
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            output_pattern
        ]
        
        print(f"Running FFMPEG extraction: {' '.join(command)}")
        try:
            subprocess.run(command, check=True)
            # Find generated frames
            frames = sorted([os.path.join(self.output_dir, f) for f in os.listdir(self.output_dir) if f.endswith('.jpg')])
            return frames
        except subprocess.CalledProcessError as e:
            print(f"FFMPEG extraction failed: {e}")
            return []
""")

# 2. FPS Normalization Engine (Fallback software normalizer if not done via FFMPEG)
write_file("services/ingestion-service/fps-normalization/normalizer.py", """import numpy as np

class FPSNormalizer:
    def __init__(self, target_fps=30):
        self.target_fps = target_fps
        
    def decimate_frames(self, original_fps, total_frames):
        '''
        Returns a boolean mask of which frame indices to keep to hit target_fps.
        '''
        if original_fps <= self.target_fps:
            return [True] * total_frames
            
        ratio = self.target_fps / original_fps
        mask = []
        accumulator = 0.0
        
        for i in range(total_frames):
            accumulator += ratio
            if accumulator >= 1.0:
                mask.append(True)
                accumulator -= 1.0
            else:
                mask.append(False)
                
        return mask
""")

# 3. Live RTSP Camera Feeds
write_file("services/ingestion-service/camera/rtsp_client.py", """import cv2
import time

class RTSPClient:
    def __init__(self, stream_url):
        self.stream_url = stream_url
        self.cap = None
        
    def connect(self):
        print(f"Connecting to RTSP Stream: {self.stream_url}")
        self.cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
        if not self.cap.isOpened():
            raise Exception("Failed to open RTSP stream")
            
    def stream_frames(self):
        '''
        Generator that yields frames continuously.
        '''
        if self.cap is None or not self.cap.isOpened():
            self.connect()
            
        while True:
            ret, frame = self.cap.read()
            if not ret:
                print("Stream disconnected. Attempting reconnect...")
                time.sleep(2)
                self.connect()
                continue
                
            yield frame
            
    def close(self):
        if self.cap:
            self.cap.release()
""")

# 4. Temporal Ring Buffer
write_file("services/ingestion-service/temporal-buffer/ring_buffer.py", """from collections import deque
import threading

class TemporalRingBuffer:
    def __init__(self, max_seconds=10, fps=30):
        '''
        Thread-safe sliding window buffer for live streams.
        Avoids RAM explosion by automatically dropping frames older than max_seconds.
        '''
        self.maxlen = int(max_seconds * fps)
        self.buffer = deque(maxlen=self.maxlen)
        self.lock = threading.Lock()
        
    def append(self, frame_data):
        with self.lock:
            self.buffer.append(frame_data)
            
    def get_snapshot(self):
        '''
        Returns a copy of the current temporal window for processing.
        '''
        with self.lock:
            return list(self.buffer)
            
    def is_full(self):
        return len(self.buffer) == self.maxlen
""")

print("Deep Ingestion Modules implemented.")
