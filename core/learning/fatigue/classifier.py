import numpy as np
import time
import logging

logger = logging.getLogger("FatigueClassifier")

class FatigueClassifier:
    def __init__(self):
        self.last_update_time = None
        self.reset()
        
        # Eye Aspect Ratio calibration and sliding window
        self.blink_timestamps = []
        self.is_blinking = False
        self.microsleep_duration = 0.0
        
        # Head pitch calibration
        self.baseline_pitch = None
        self.pitch_calibration_count = 0
        self.pitch_calibration_sum = 0.0
        self.droop_duration = 0.0
        
        # Wrist velocity calibration (2-minute baseline)
        self.prev_wrist_pos = None
        self.smoothed_velocity = 0.0
        self.calibration_time = 0.0
        self.baseline_velocity_sum = 0.0
        self.baseline_velocity_weight = 0.0
        self.baseline_velocity = None
        
    def reset(self):
        """Resets sustained state when the operator resumes or a new session starts."""
        self.sustained_fatigue_time = 0.0
        self.state = "ok"
        self.droop_duration = 0.0
        self.microsleep_duration = 0.0
        self.prev_wrist_pos = None
        # Note: we do not reset baseline_pitch or baseline_velocity here as they are
        # calibrated per session and cached. We reset calibration timers separately or dynamically.
        
    def reset_calibration(self):
        """Forcing recalibration of the baseline metrics."""
        self.baseline_pitch = None
        self.pitch_calibration_count = 0
        self.pitch_calibration_sum = 0.0
        self.calibration_time = 0.0
        self.baseline_velocity_sum = 0.0
        self.baseline_velocity_weight = 0.0
        self.baseline_velocity = None
        self.smoothed_velocity = 0.0
        self.prev_wrist_pos = None

    def _dist(self, a, b):
        return np.linalg.norm(a - b)

    def _calc_ear(self, eye_pts):
        """Calculates Eye Aspect Ratio (EAR) for 6 eye coordinates.
        eye_pts index map:
        0: outer corner
        1: top-left
        2: top-right
        3: inner corner
        4: bottom-right
        5: bottom-left
        """
        p = eye_pts[:, :3] # use x, y, z
        ear = (self._dist(p[1], p[5]) + self._dist(p[2], p[4])) / (2.0 * self._dist(p[0], p[3]) + 1e-6)
        return ear

    def update(self, face_landmarks, pose_landmarks, is_recording=False) -> dict:
        """Runs the 1-frame update cycle for fatigue heuristics.
        
        Parameters:
        - face_landmarks: numpy array of shape (13, 4) containing face landmarks subset:
          [nose_tip (0), left_eye (1..6), right_eye (7..12)]
        - pose_landmarks: numpy array of shape (33, 4) pose landmarks
        - is_recording: whether a session recording is actively running (used for baseline timing)
        """
        now = time.time()
        if self.last_update_time is None:
            self.last_update_time = now
            return {
                "score": 0.0,
                "state": "ok",
                "signals": {"ear": 0.3, "head_pitch": 0.0, "hand_velocity": 0.0, "calibrating": True}
            }
            
        dt = now - self.last_update_time
        self.last_update_time = now
        if dt <= 0:
            dt = 0.016 # fallback 60fps
            
        # ── 1. Eye Aspect Ratio & Blink Rate ──────────────────────────────────
        ear = 0.3 # default normal
        eye_fatigue_score = 0.0
        
        if face_landmarks is not None and len(face_landmarks) >= 13:
            # Extract left eye landmarks
            # Indices inside the 13-point face subset:
            # 33 (outer): 1, 160 (top-left): 3, 158 (top-right): 4, 133 (inner): 2, 153 (bottom-right): 6, 144 (bottom-left): 5
            left_eye_indices = [1, 3, 4, 2, 6, 5]
            left_eye_pts = face_landmarks[left_eye_indices]
            ear_left = self._calc_ear(left_eye_pts)
            
            # Extract right eye landmarks
            # 263 (outer): 7, 385 (top-left): 9, 387 (top-right): 10, 362 (inner): 8, 373 (bottom-right): 12, 380 (bottom-left): 11
            right_eye_indices = [7, 9, 10, 8, 12, 11]
            right_eye_pts = face_landmarks[right_eye_indices]
            ear_right = self._calc_ear(right_eye_pts)
            
            ear = float((ear_left + ear_right) / 2.0)
            
            # Blink state machine
            if ear < 0.2:
                self.microsleep_duration += dt
                if not self.is_blinking:
                    self.is_blinking = True
                    self.blink_timestamps.append(now)
            else:
                self.microsleep_duration = 0.0
                if self.is_blinking:
                    self.is_blinking = False
                    
            # Keep only blinks within last 60s
            self.blink_timestamps = [t for t in self.blink_timestamps if now - t <= 60.0]
            blink_rate = len(self.blink_timestamps)
            
            # Evaluate Eye Fatigue
            if self.microsleep_duration >= 1.5:
                # Prolonged eye closure (microsleep)
                eye_fatigue_score = 1.0
            else:
                # Blink rate bounds: normal 15–20. fatigue <12 or >25
                if blink_rate < 15:
                    # Scaled down to 5 blinks/min -> score 1.0
                    eye_fatigue_score = max(0.0, min(1.0, (15 - blink_rate) / 10.0))
                elif blink_rate > 20:
                    # Scaled up to 30 blinks/min -> score 1.0
                    eye_fatigue_score = max(0.0, min(1.0, (blink_rate - 20) / 10.0))
                else:
                    eye_fatigue_score = 0.0
        
        # ── 2. Head Pitch Deviation ───────────────────────────────────────────
        head_pitch_deviation = 0.0
        head_fatigue_score = 0.0
        
        if face_landmarks is not None and len(face_landmarks) >= 13:
            # Nose tip is index 0
            nose_tip = face_landmarks[0, :3]
            
            # Eye midpoint
            left_eye_center = np.mean(face_landmarks[1:7, :3], axis=0)
            right_eye_center = np.mean(face_landmarks[7:13, :3], axis=0)
            eye_midpoint = (left_eye_center + right_eye_center) / 2.0
            
            v = nose_tip - eye_midpoint
            # Compute head pitch: angle in y-z plane (y is down, z is forward)
            # v[1] is y difference, -v[2] is positive forward depth difference
            pitch = float(np.arctan2(v[1], -v[2] + 1e-6) * 180.0 / np.pi)
            
            # Calibrate baseline pitch during the first 5 seconds or 300 frames
            if self.baseline_pitch is None:
                self.pitch_calibration_sum += pitch
                self.pitch_calibration_count += 1
                if self.pitch_calibration_count >= 100: # ~5s at 20Hz-60Hz
                    self.baseline_pitch = self.pitch_calibration_sum / self.pitch_calibration_count
                    logger.info(f"Head pitch calibrated: baseline={self.baseline_pitch:.2f}°")
            else:
                head_pitch_deviation = float(abs(pitch - self.baseline_pitch))
                
                # Check for drooping head: deviation > 20°
                if head_pitch_deviation > 20.0:
                    self.droop_duration += dt
                else:
                    self.droop_duration = 0.0
                    
                if self.droop_duration >= 5.0:
                    # Drooping head for > 5 seconds
                    head_fatigue_score = 1.0
                else:
                    head_fatigue_score = max(0.0, min(1.0, head_pitch_deviation / 20.0))
        
        # ── 3. Wrist Motion Velocity ──────────────────────────────────────────
        hand_fatigue_score = 0.0
        velocity = 0.0
        
        # Track wrist position (pose landmark 16)
        wrist_pos = None
        if pose_landmarks is not None and len(pose_landmarks) > 16:
            wrist_pos = pose_landmarks[16, :3]
            
        if wrist_pos is not None:
            if self.prev_wrist_pos is not None:
                # Euclidean distance
                dist_moved = self._dist(wrist_pos, self.prev_wrist_pos)
                # Filter out microscopic movements (sensor jitter) below 0.001
                if dist_moved > 0.001:
                    velocity = dist_moved / dt
                else:
                    velocity = 0.0
                    
                # Smooth velocity with exponential moving average (10s window)
                alpha = min(1.0, dt / 10.0)
                self.smoothed_velocity = alpha * velocity + (1.0 - alpha) * self.smoothed_velocity
            else:
                self.smoothed_velocity = 0.0
                
            self.prev_wrist_pos = wrist_pos.copy()
            
            # Perform baseline calibration during active recording sessions (first 2 minutes)
            if is_recording:
                if self.calibration_time < 120.0:
                    self.calibration_time += dt
                    self.baseline_velocity_sum += velocity * dt
                    self.baseline_velocity_weight += dt
                    if self.baseline_velocity_weight > 0:
                        self.baseline_velocity = self.baseline_velocity_sum / self.baseline_velocity_weight
                else:
                    # Baseline established, compare current velocity
                    if self.baseline_velocity is not None and self.baseline_velocity > 1e-4:
                        ratio = self.smoothed_velocity / self.baseline_velocity
                        # If velocity drops below baseline, score increases
                        # Score is 1.0 when velocity is <= 50% of baseline
                        if ratio < 1.0:
                            hand_fatigue_score = max(0.0, min(1.0, (1.0 - ratio) / 0.5))
                        else:
                            hand_fatigue_score = 0.0
                            
        # ── 4. Combine Signals into Overall Fatigue Score ─────────────────────
        # If still calibrating baselines, we default scores to 0
        is_calibrating = (self.baseline_pitch is None) or (is_recording and self.calibration_time < 120.0)
        
        # Weights: 40% Eyes, 40% Head, 20% Hands
        fatigue_score = float(0.4 * eye_fatigue_score + 0.4 * head_fatigue_score + 0.2 * hand_fatigue_score)
        
        # State classification logic:
        # If score > 0.65, count duration. If sustained for 30s -> fatigued state.
        if fatigue_score > 0.65:
            self.sustained_fatigue_time += dt
            if self.sustained_fatigue_time >= 30.0:
                self.state = "fatigued"
            elif self.state != "fatigued":
                self.state = "caution"
        else:
            self.sustained_fatigue_time = max(0.0, self.sustained_fatigue_time - dt)
            if self.state != "fatigued":
                if fatigue_score >= 0.4:
                    self.state = "caution"
                else:
                    self.state = "ok"
                    
        return {
            "score": round(fatigue_score, 4),
            "state": self.state,
            "signals": {
                "ear": round(ear, 4),
                "head_pitch": round(head_pitch_deviation, 2),
                "hand_velocity": round(self.smoothed_velocity, 4)
            },
            "calibrating": is_calibrating
        }
