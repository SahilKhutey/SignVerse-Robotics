import threading
import time
import os
import cv2
from camera.rtsp_client import RTSPClient
from app.ffmpeg.frame_extractor import stabilize_frame
import redis
import json

class RTSPIngester:
    def __init__(self, stream_url, redis_host='localhost', redis_port=6379):
        self.client = RTSPClient(stream_url)
        self.redis_conn = redis.Redis(host=redis_host, port=redis_port)
        self.running = False
        self.thread = None
        
    def start(self, target_size=(640, 480), denoise=True, stabilize=True):
        self.running = True
        self.thread = threading.Thread(
            target=self._ingest_loop,
            args=(target_size, denoise, stabilize),
            daemon=True
        )
        self.thread.start()
        
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        self.client.close()

    def _ingest_loop(self, target_size, denoise, stabilize):
        frame_idx = 0
        prev_frame = None
        
        try:
            for frame in self.client.stream_frames():
                if not self.running:
                    break
                    
                # 1. Resize
                if target_size:
                    frame = cv2.resize(frame, target_size, interpolation=cv2.INTER_LINEAR)
                    
                # 2. Denoise
                if denoise:
                    frame = cv2.GaussianBlur(frame, (3, 3), 0)
                    
                # 3. Stabilize
                if stabilize:
                    frame = stabilize_frame(frame, prev_frame)
                    prev_frame = frame.copy()
                
                # Publish frame to Redis Queue
                _, jpeg_bytes = cv2.imencode('.jpg', frame)
                import base64
                encoded_frame = base64.b64encode(jpeg_bytes).decode('utf-8')
                
                payload = {
                    "frame_index": frame_idx,
                    "timestamp": time.time(),
                    "data": encoded_frame
                }
                
                self.redis_conn.lpush("rtsp_ingestion_queue", json.dumps(payload))
                frame_idx += 1
                
                # Throttle frame rate to ~30 FPS
                time.sleep(1.0 / 30.0)
        except Exception as e:
            print(f"RTSP Ingester loop crashed: {e}")
            self.running = False
