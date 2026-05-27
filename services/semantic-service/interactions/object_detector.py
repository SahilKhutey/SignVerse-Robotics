import cv2
import numpy as np
from ultralytics import YOLO

class ObjectDetector:
    def __init__(self, model_path='yolov8n.pt'):
        self.model = YOLO(model_path)
        
    def detect_objects(self, frame_path, hand_coords=None):
        '''
        Extracts bounding boxes. If hand_coords provided, computes proximity interactions.
        '''
        image = cv2.imread(frame_path)
        if image is None: return []
        
        results = self.model(image)
        detected = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                cls_name = self.model.names[cls_id]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                interaction = None
                if hand_coords:
                    # Calculate distance from hand to object center
                    obj_cx = (x1 + x2) / 2
                    obj_cy = (y1 + y2) / 2
                    for hand in hand_coords:
                        dist = np.sqrt((hand['x'] - obj_cx)**2 + (hand['y'] - obj_cy)**2)
                        if dist < 50: # pixel distance threshold
                            interaction = {"hand": hand.get('label', 'unknown'), "distance": dist}
                            
                detected.append({
                    "object": cls_name,
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                    "interaction": interaction
                })
        return detected
