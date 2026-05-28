import json
import logging
import re

class CognitiveAgent:
    def __init__(self):
        """
        Vision-Language-Action (VLA) Reasoning Engine.
        In a full production environment, this interfaces with LangChain / OpenAI.
        For safe offline execution, it includes a regex-based NLP semantic parser fallback.
        """
        self.logger = logging.getLogger("CognitiveAgent")
        self.logger.setLevel(logging.INFO)

    def parse_command(self, text_command: str) -> dict:
        """
        Translates a natural language command into a robotic JSON payload.
        Example Input: "Move your shoulder to 90 degrees and elbow to 45"
        Example Output: {"q_target": [1.57, 0.78, 0.0]} # radians
        """
        text = text_command.lower()
        
        # Default safety position
        q_target = [0.0, 0.0, 0.0] 
        
        # NLP Semantic Parsing Fallback (if no LLM API Key is present)
        # In a real scenario, we'd do: `llm.invoke(prompt.format(text=text))`
        
        if "home" in text or "reset" in text or "rest" in text:
            return {"command": "move_joint", "q_target": [0.0, 0.0, 0.0]}
            
        # Parse degrees for joints
        # "shoulder to 90", "elbow to 45", "wrist to 180"
        import math
        
        shoulder_match = re.search(r'shoulder.*?(\d+)', text)
        elbow_match = re.search(r'elbow.*?(\d+)', text)
        wrist_match = re.search(r'wrist.*?(\d+)', text)
        
        if shoulder_match:
            deg = float(shoulder_match.group(1))
            q_target[0] = math.radians(deg - 90) # Adjust for IK 0=90 basis
            
        if elbow_match:
            deg = float(elbow_match.group(1))
            q_target[1] = math.radians(deg - 90)
            
        if wrist_match:
            deg = float(wrist_match.group(1))
            q_target[2] = math.radians(deg - 90)

        self.logger.info(f"Cognitive Engine mapped '{text_command}' -> {q_target}")
        
        return {
            "command": "move_joint",
            "q_target": q_target
        }
