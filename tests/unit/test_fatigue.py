import pytest
import numpy as np
import time
from unittest.mock import patch
from core.learning.fatigue.classifier import FatigueClassifier

def create_mock_face_landmarks(ear_value=0.3, pitch_angle=0.0):
    """Generates a mock 13-point face landmark array.
    Points:
    0: Nose tip
    1..6: Left eye
    7..12: Right eye
    """
    landmarks = np.zeros((13, 4))
    
    # Left eye coordinates mapping
    # 33 (outer), 160 (top-left), 158 (top-right), 133 (inner), 153 (bottom-right), 144 (bottom-left)
    landmarks[1] = [0.1, 0.0, 0.0, 1.0] # outer corner
    landmarks[2] = [0.2, 0.0, 0.0, 1.0] # inner corner
    
    landmarks[3] = [0.13, -ear_value * 0.1, 0.0, 1.0] # top-left
    landmarks[4] = [0.17, -ear_value * 0.1, 0.0, 1.0] # top-right
    landmarks[5] = [0.13, ear_value * 0.1, 0.0, 1.0]  # bottom-left
    landmarks[6] = [0.17, ear_value * 0.1, 0.0, 1.0]  # bottom-right
    
    # Right eye coordinates mapping
    landmarks[7] = [0.3, 0.0, 0.0, 1.0] # outer corner
    landmarks[8] = [0.4, 0.0, 0.0, 1.0] # inner corner
    
    landmarks[9] = [0.33, -ear_value * 0.1, 0.0, 1.0] # top-left
    landmarks[10] = [0.37, -ear_value * 0.1, 0.0, 1.0] # top-right
    landmarks[11] = [0.33, ear_value * 0.1, 0.0, 1.0]  # bottom-left
    landmarks[12] = [0.37, ear_value * 0.1, 0.0, 1.0]  # bottom-right
    
    # Nose tip (index 0) and eye midpoint
    rad = np.radians(pitch_angle)
    landmarks[0] = [0.25, 0.1 * np.tan(rad), -0.1, 1.0]
    
    return landmarks

def create_mock_pose_landmarks(wrist_x=0.0):
    landmarks = np.zeros((33, 4))
    # Right wrist is index 16
    landmarks[16] = [wrist_x, 0.0, 0.0, 1.0]
    return landmarks

def test_classifier_ear_calculation():
    classifier = FatigueClassifier()
    
    # Test normal eyes (EAR = 0.3)
    normal_face = create_mock_face_landmarks(ear_value=0.3)
    res = classifier.update(normal_face, None)
    assert abs(res["signals"]["ear"] - 0.3) < 0.02
    assert res["state"] == "ok"
    
    # Test closed eyes / blink (EAR = 0.1)
    closed_face = create_mock_face_landmarks(ear_value=0.1)
    classifier.update(closed_face, None)
    assert classifier.is_blinking is True

def test_classifier_pitch_calibration_and_droop():
    classifier = FatigueClassifier()
    
    # Run 105 calibration ticks at 0 degrees pitch (first tick is initialization)
    current_time = 1000.0
    for _ in range(105):
        with patch('time.time', return_value=current_time):
            cal_face = create_mock_face_landmarks(pitch_angle=0.0)
            classifier.update(cal_face, None)
        current_time += 0.1
        
    assert classifier.baseline_pitch is not None
    assert abs(classifier.baseline_pitch) < 1e-2
    
    # Feed head drooping frames (pitch = 25 degrees)
    droop_face = create_mock_face_landmarks(pitch_angle=25.0)
    
    # Tick for 6 seconds (60 frames at 0.1s dt) to trigger drooping duration > 5s
    res = None
    for _ in range(60):
        with patch('time.time', return_value=current_time):
            res = classifier.update(droop_face, None)
        current_time += 0.1
        
    assert res["signals"]["head_pitch"] > 20.0
    assert res["score"] > 0.3

def test_wrist_velocity_calibration_and_decay():
    classifier = FatigueClassifier()
    current_time = 1000.0
    
    # Tick 130 times with dt = 1.0s to calibrate the baseline velocity (needs 120s of active recording)
    for i in range(130):
        with patch('time.time', return_value=current_time):
            # Right wrist moves by 0.5 units every second (velocity = 0.5 units/s)
            pose_lms = create_mock_pose_landmarks(wrist_x=i * 0.5)
            res = classifier.update(None, pose_lms, is_recording=True)
        current_time += 1.0
        
    assert classifier.baseline_velocity is not None
    assert abs(classifier.baseline_velocity - 0.5) < 0.05
    
    # Drop velocity significantly to 0.02 units/s (decay > 50% from baseline 0.5)
    # Tick 15 times to let smoothed velocity update
    for i in range(15):
        with patch('time.time', return_value=current_time):
            # Right wrist moves slowly by 0.02 units per second
            pose_lms = create_mock_pose_landmarks(wrist_x=65.0 + i * 0.02)
            res = classifier.update(None, pose_lms, is_recording=True)
        current_time += 1.0
        
    # Fatigue score should increase because velocity dropped below 50% of baseline
    assert res["score"] > 0.0
