import pytest
from langchain_core.language_models.fake import FakeListLLM
from core.semantics.intent_detector import IntentDetector
from core.reasoning.motion_reasoner import MotionReasoner

def test_intent_detector_build():
    # Mock LLM response string structured as JSON
    mock_response = '{"goal": "navigate_to_door", "confidence": 0.95}'
    mock_llm = FakeListLLM(responses=[mock_response])
    
    detector = IntentDetector(llm=mock_llm)
    result = detector.detect("human is pointing at the door")
    
    assert isinstance(result, dict)
    assert result["goal"] == "navigate_to_door"
    assert result["confidence"] == 0.95

def test_motion_reasoner_build():
    # Mock LLM response string structured as JSON
    mock_response = '{"intent": "navigate_to_door", "required_skills": ["walk", "obstacle_avoidance"], "feasibility": "high"}'
    mock_llm = FakeListLLM(responses=[mock_response])
    
    reasoner = MotionReasoner(llm=mock_llm)
    result = reasoner.reason("navigate_to_door")
    
    assert isinstance(result, dict)
    assert result["intent"] == "navigate_to_door"
    assert "walk" in result["required_skills"]
    assert result["feasibility"] == "high"

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_cognition_build.py"])
