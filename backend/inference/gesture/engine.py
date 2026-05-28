import collections
import numpy as np

class GestureEngine:
    """
    Temporal Gesture Recognition Engine.
    Uses a rolling window of pose frames to classify semantic intent.
    """
    def __init__(self, window_size=30):
        # Store the last N frames
        self.window_size = window_size
        self.pose_buffer = collections.deque(maxlen=window_size)
        
        # State tracking for cooldowns
        self.last_gesture = None
        self.cooldown = 0

    def process_frame(self, pose_landmarks):
        """
        Takes raw MediaPipe pose landmarks for the current frame.
        Returns a dictionary with detected gesture and confidence, or None.
        """
        if not pose_landmarks or len(pose_landmarks) < 17:
            return None
        
        # Append just the Right Wrist (16) to the temporal buffer
        r_wrist = np.array(pose_landmarks[16][:3])
        self.pose_buffer.append(r_wrist)

        if self.cooldown > 0:
            self.cooldown -= 1
            return None

        # Only evaluate if we have a full window
        if len(self.pose_buffer) == self.window_size:
            return self.evaluate_buffer()
        
        return None

    def evaluate_buffer(self):
        """
        Evaluates the temporal buffer for heuristic gestures.
        In a full ML pipeline, this is where the LSTM / Temporal CNN inference occurs.
        """
        # Convert buffer to numpy array for vectorized operations
        trajectory = np.array(self.pose_buffer)
        
        # Calculate overall displacement from start to end of window
        start_pos = trajectory[0]
        end_pos = trajectory[-1]
        displacement = end_pos - start_pos
        
        # Calculate velocity (displacement per frame)
        # MediaPipe coordinates: X is horizontal, Y is vertical (0 at top)
        dx = displacement[0]
        dy = displacement[1]
        
        # Simple Swipe Detection Heuristic
        # If horizontal displacement is large and vertical is small
        if abs(dx) > 0.4 and abs(dy) < 0.2:
            gesture = "swipe_right" if dx > 0 else "swipe_left"
            self.cooldown = 30 # Wait 30 frames before detecting another gesture
            self.pose_buffer.clear()
            return {
                "gesture": gesture,
                "confidence": min(0.99, abs(dx) * 1.5) # Fake confidence based on magnitude
            }

        # Simple Wave Detection Heuristic
        # If there's high variance in X but low net displacement
        x_variance = np.var(trajectory[:, 0])
        if x_variance > 0.05 and abs(dx) < 0.2:
            self.cooldown = 45
            self.pose_buffer.clear()
            return {
                "gesture": "wave",
                "confidence": 0.85
            }
            
        return None
