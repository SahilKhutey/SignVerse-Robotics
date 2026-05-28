import os
import time
import json
import sqlite3
import uuid
import cv2
import numpy as np

from core.perception.providers.mediapipe_provider import MediaPipeHolisticProvider

class DataCollector:
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        
        # Directories
        self.raw_dir = os.path.join("datasets", "raw")
        self.img_dir = os.path.join(self.raw_dir, "images")
        os.makedirs(self.img_dir, exist_ok=True)
        
        # Database
        self.db_path = os.path.join(self.raw_dir, "teleoperation.db")
        self._init_db()
        
        # Perception Provider
        self.perception = MediaPipeHolisticProvider(static_image_mode=False)

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Enable Write-Ahead Logging for high-speed concurrent access
        cursor.execute("PRAGMA journal_mode=WAL;")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS frames (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                timestamp_ms INTEGER,
                image_path TEXT,
                json_data TEXT
            )
        ''')
        conn.commit()
        conn.close()

    def run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            print(f"Error: Could not open camera {self.camera_index}")
            return

        print("Camera loaded. Press 'r' to toggle recording. Press 'q' to quit.")
        
        is_recording = False
        session_id = None
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # 1. Perception
                landmarks = self.perception.detect(frame)
                
                display_frame = frame.copy()
                
                if is_recording:
                    # Draw red dot
                    cv2.circle(display_frame, (30, 30), 10, (0, 0, 255), -1)
                    cv2.putText(display_frame, f"REC: {session_id[:8]}", (50, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    
                    # 2. Save Data
                    timestamp_ms = int(time.time() * 1000)
                    frame_id = str(uuid.uuid4())
                    
                    img_path = os.path.join(self.img_dir, f"{frame_id}.jpg")
                    
                    # Save Image
                    cv2.imwrite(img_path, frame)
                    
                    # Create JSON String
                    landmarks_dict = {}
                    if landmarks:
                        for key, lm_array in landmarks.items():
                            if lm_array is not None:
                                landmarks_dict[key] = lm_array.tolist()
                            else:
                                landmarks_dict[key] = None
                                
                    json_string = json.dumps(landmarks_dict)
                        
                    # 3. Database Entry
                    cursor.execute(
                        "INSERT INTO frames (id, session_id, timestamp_ms, image_path, json_data) VALUES (?, ?, ?, ?, ?)",
                        (frame_id, session_id, timestamp_ms, img_path, json_string)
                    )
                    conn.commit()
                else:
                    cv2.putText(display_frame, "PAUSED (Press 'r' to Record)", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

                # Show frame
                cv2.imshow("SignVerse Teleoperation Collector", display_frame)

                # Keyboard controls
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('r'):
                    is_recording = not is_recording
                    if is_recording:
                        session_id = str(uuid.uuid4())
                        print(f"Started Recording Session: {session_id}")
                    else:
                        print("Stopped Recording.")

        finally:
            cap.release()
            cv2.destroyAllWindows()
            conn.close()
            self.perception.close()
            print("Shutting down data collector.")

if __name__ == "__main__":
    collector = DataCollector()
    collector.run()
