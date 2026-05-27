import cv2
import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import mediapipe as mp
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False

class HandPerceptionEngine:
    def __init__(self):
        if MP_AVAILABLE:
            self.mp_hands = mp.solutions.hands
            self.mp_draw = mp.solutions.drawing_utils
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5
            )
            logger.info("MediaPipe Hand Engine initialized.")
        else:
            logger.warning("MediaPipe not installed. Running in Mock Mode.")

    def extract_landmarks(self, image_np: np.ndarray):
        if not MP_AVAILABLE:
            return {"status": "mock", "landmarks": [(0.5, 0.5, 0.1)] * 21}
            
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        extracted = []
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                marks = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in hand_landmarks.landmark]
                extracted.append(marks)
                
        return {"status": "success", "hands_detected": len(extracted), "landmarks": extracted}
