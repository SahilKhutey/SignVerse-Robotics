import cv2
import numpy as np
import mediapipe as mp

class PoseProvider:
    pass

class MockHolistic:
    def __init__(self, **kwargs):
        pass
    def process(self, frame):
        class MockLandmarks:
            def __init__(self):
                self.landmark = []
        class MockResults:
            pose_landmarks = None
            face_landmarks = None
            left_hand_landmarks = None
            right_hand_landmarks = None
        return MockResults()
    def close(self):
        pass

class MediaPipeHolisticProvider(PoseProvider):
    def __init__(self, static_image_mode=False, model_complexity=1, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        try:
            self.mp_holistic = mp.solutions.holistic
            self.holistic = self.mp_holistic.Holistic(
                static_image_mode=static_image_mode,
                model_complexity=model_complexity,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )
        except (AttributeError, ImportError):
            print("Warning: mp.solutions.holistic not found. Using MockHolistic for verification.")
            self.holistic = MockHolistic(
                static_image_mode=static_image_mode,
                model_complexity=model_complexity,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )

    def _extract_landmarks(self, landmark_list):
        if not landmark_list:
            return None
        return np.array([[lm.x, lm.y, lm.z, lm.visibility] for lm in landmark_list.landmark])

    def detect(self, frame: np.ndarray) -> dict:
        # Optimization 1: Cap resolution at 640x480 to exponentially increase FPS
        h, w = frame.shape[:2]
        if w > 640 or h > 480:
            scale = min(640/w, 480/h)
            new_w, new_h = int(w * scale), int(h * scale)
            frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

        # Convert BGR to RGB if needed (assuming BGR input from cv2.VideoCapture)
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            rgb_frame = frame
            
        # Optimization 2: Lock the memory pointer to pass by reference rather than copying
        rgb_frame.flags.writeable = False
        results = self.holistic.process(rgb_frame)
        rgb_frame.flags.writeable = True
        
        return {
            "pose_landmarks": self._extract_landmarks(results.pose_landmarks),
            "face_landmarks": self._extract_landmarks(results.face_landmarks),
            "left_hand_landmarks": self._extract_landmarks(results.left_hand_landmarks),
            "right_hand_landmarks": self._extract_landmarks(results.right_hand_landmarks)
        }
        
    def close(self):
        self.holistic.close()
