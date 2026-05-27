import cv2
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
