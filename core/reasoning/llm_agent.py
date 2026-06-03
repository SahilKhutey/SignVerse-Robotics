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
        self.chat_history = []

    def parse_command(self, text_command: str) -> dict:
        """
        Translates a natural language command into a robotic JSON payload.
        Example Input: "Move your shoulder to 90 degrees and elbow to 45"
        Example Output: {"q_target": [1.57, 0.78, 0.0]} # radians
        """
        text = text_command.lower()
        
        # Default safety position
        q_target = [0.0, 0.0, 0.0] 
        
        # Check referential commands (e.g. "Do what you did last time but slower")
        is_referential = "last time" in text or "previous" in text or "slower" in text or "faster" in text
        
        last_entry = None
        if is_referential and self.chat_history:
            # Retrieve last successful command with target angles
            for entry in reversed(self.chat_history):
                if entry.get("q_target") is not None:
                    last_entry = entry
                    break
        
        if last_entry:
            q_target = list(last_entry["q_target"])
            self.logger.info(f"Resolved referential context from previous command: {last_entry['command_text']}")
            
            # Apply speed scaling adjustments
            if "slower" in text:
                speed_scaling = 0.5
            elif "faster" in text:
                speed_scaling = 1.5
            else:
                speed_scaling = 1.0
        else:
            speed_scaling = 1.0
            if "home" in text or "reset" in text or "rest" in text:
                q_target = [0.0, 0.0, 0.0]
            else:
                # Parse degrees for joints
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
                    
                # Add default movements if no numbers found
                if not shoulder_match and not elbow_match and not wrist_match:
                    if "extend" in text:
                        q_target = [0.0, 1.3, 1.0]
                    elif "pick" in text or "grab" in text:
                        q_target = [0.26, 0.78, -0.52]
                    else:
                        q_target = [0.1, 0.2, 0.3]
                        
        response = {
            "command": "move_joint",
            "q_target": q_target,
            "speed_scaling": speed_scaling,
            "command_text": text_command
        }
        
        # Save to chat history
        self.chat_history.append(response)
        if len(self.chat_history) > 50:
            self.chat_history.pop(0)
            
        self.logger.info(f"Cognitive Engine mapped '{text_command}' -> {q_target} (speed scaling: {speed_scaling})")
        return response
