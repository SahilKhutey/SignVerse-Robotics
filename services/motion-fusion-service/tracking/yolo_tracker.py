import cv2
import numpy as np
from ultralytics import YOLO

class MultiPersonTracker:
    def __init__(self, model_path='yolov8n.pt', tracker_type='bytetrack.yaml'):
        '''
        Uses Ultralytics ByteTrack for multi-person persistent identity tracking.
        '''
        self.model = YOLO(model_path)
        self.tracker_type = tracker_type
        
    def track_frame(self, frame_path):
        image = cv2.imread(frame_path)
        if image is None: return []
        
        # Run inference with tracking
        results = self.model.track(image, persist=True, tracker=self.tracker_type, classes=[0], verbose=False) # 0 is person class
        
        tracked_identities = []
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            confs = results[0].boxes.conf.cpu().tolist()
            
            for box, track_id, conf in zip(boxes, track_ids, confs):
                x1, y1, x2, y2 = box
                tracked_identities.append({
                    "track_id": track_id,
                    "bbox": [float(x1), float(y1), float(x2), float(y2)],
                    "confidence": float(conf)
                })
                
        return tracked_identities
