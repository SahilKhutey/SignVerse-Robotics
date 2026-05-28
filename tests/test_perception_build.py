import numpy as np
import pytest
from core.perception.providers.mediapipe_provider import MediaPipeHolisticProvider

def test_mediapipe_provider_build_and_detect():
    # 1. Initialize the provider (tests if mediapipe loads correctly)
    provider = MediaPipeHolisticProvider(static_image_mode=True)
    
    # 2. Create a dummy black image (640x480 RGB)
    # Using a black image means no hands/faces will be detected, 
    # but the pipeline should process it without crashing.
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # 3. Run detection
    results = provider.detect(dummy_frame)
    
    # 4. Assert structure is correct
    assert isinstance(results, dict)
    assert "pose_landmarks" in results
    assert "face_landmarks" in results
    assert "left_hand_landmarks" in results
    assert "right_hand_landmarks" in results
    
    # Since it's a black image, these should be None
    assert results["pose_landmarks"] is None
    assert results["face_landmarks"] is None
    assert results["left_hand_landmarks"] is None
    assert results["right_hand_landmarks"] is None
    
    provider.close()

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_perception_build.py"])
