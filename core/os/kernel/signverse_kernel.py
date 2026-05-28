import numpy as np
import torch
import multiprocessing as mp
import queue
import time
from core.perception.providers.mediapipe_provider import MediaPipeHolisticProvider
from core.learning.models.behavior_cloning import BehaviorCloningMLP
from core.robotics.kinematics.inverse_kinematics import InverseKinematicsSolver
from core.robotics.simulation.mujoco_exporter import MuJoCoBridge
from core.robotics.control.serial_bridge import SerialBridge
from core.os.utils.logger import setup_logger

logger = setup_logger("SignVerseKernel")

def _perception_worker(frame_queue, state_queue):
    """Background process for running MediaPipe (GIL isolated)"""
    perception = MediaPipeHolisticProvider(static_image_mode=False)
    while True:
        try:
            frame = frame_queue.get()
            if frame is None:
                break
            landmarks = perception.detect(frame)
            # Format state for Behavior Cloning (63-dim Right Hand)
            state_tensor = torch.zeros(1, 63)
            if landmarks and "Right Hand" in landmarks and landmarks["Right Hand"] is not None:
                rh = landmarks["Right Hand"]
                if rh.shape == (21, 3):
                    state_tensor = torch.tensor(rh.flatten(), dtype=torch.float32).unsqueeze(0)
            
            # Keep only the freshest state
            try:
                state_queue.put_nowait(state_tensor)
            except queue.Full:
                state_queue.get_nowait()
                state_queue.put_nowait(state_tensor)
                
        except Exception:
            pass
    perception.close()

class SignVerseKernel:
    def __init__(self, xml_model_string: str = None):
        """
        Initializes the entire OS subsystem spanning Perception, ML, and Robotics.
        """
        # 1. Perception Layer (Isolated Process)
        self.frame_queue = mp.Queue(maxsize=2)
        self.state_queue = mp.Queue(maxsize=2)
        self.command_queue = mp.Queue(maxsize=5) # For LLM Cognitive Semantic override
        self.perception_process = mp.Process(target=_perception_worker, args=(self.frame_queue, self.state_queue))
        self.perception_process.daemon = True
        self.perception_process.start()
        
        self.last_state = torch.zeros(1, 63) # Seed initial state
        
        # 2. AI Policy Layer (Behavior Cloning)
        import os
        self.use_ai = False
        self.policy = BehaviorCloningMLP()
        model_path = "models/checkpoints/bc_model.pth"
        if os.path.exists(model_path):
            try:
                self.policy.load_state_dict(torch.load(model_path, map_location='cpu'))
                self.use_ai = True
                logger.info("AI Inference Mode: ENABLED")
            except Exception as e:
                logger.error(f"Failed to load AI checkpoint: {e}")
        else:
            logger.warning("AI Inference Mode: DISABLED (No checkpoint found). Falling back to Mathematical IK.")
            
        self.policy.eval()
        
        # 3. Robotics Layer
        def dummy_fk(q):
            return np.array([q[0], q[1], q[2] if len(q) > 2 else 0.0])
            
        self.ik_solver = InverseKinematicsSolver(forward_kinematics_fn=dummy_fk)
        
        # Base XML for a generic robot arm
        if xml_model_string is None:
            xml_model_string = """
            <mujoco>
              <worldbody>
                <body>
                  <joint name="j1" type="hinge" axis="0 0 1"/>
                  <geom type="capsule" size="0.1 0.5"/>
                </body>
              </worldbody>
            </mujoco>
            """
        self.simulation = MuJoCoBridge(xml_model_string)
        
        # 4. Hardware Bridge Layer
        self.serial = SerialBridge()
        self.serial.connect()

    def tick(self, frame: np.ndarray) -> bool:
        """
        Executes one real-time cycle of the SignVerse OS asynchronously.
        Returns True if successful.
        """
        try:
            # 1. Push frame to background perception (non-blocking)
            try:
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                pass # Drop frame if perception is lagging
                
            # 2. Pull freshest state (non-blocking)
            try:
                self.last_state = self.state_queue.get_nowait()
            except queue.Empty:
                pass # Use last known state if perception is still processing
            
            # 2.5 Intercept LLM Semantic Commands
            try:
                semantic_command = self.command_queue.get_nowait()
                if semantic_command and "q_target" in semantic_command:
                    # OVERRIDE Computer Vision / AI with Cognitive Intent
                    q_target = np.array(semantic_command["q_target"])
                    ik_result = {"q": q_target, "converged": True}
                    
                    # Push to hardware
                    if self.simulation.model is not None:
                        q_pos_array = np.array([ik_result["q"][0]])
                        self.simulation.set_joint_angles(q_pos_array)
                    if hasattr(self, 'serial') and self.serial.is_connected:
                        if len(ik_result["q"]) >= 3:
                            self.serial.transmit_angles(ik_result["q"][:3])
                            
                    return {
                        "status": "CONNECTED",
                        "timestamp": time.time(),
                        "mode": "cognitive_override",
                        "q_target": ik_result["q"].tolist()
                    }
            except queue.Empty:
                pass
            
            # 3 & 4. Dual-Mode Kinematics (AI Inference vs Math Fallback)
            if self.use_ai:
                with torch.no_grad():
                    action_tensor = self.policy(self.last_state)
                # AI directly predicts joint angles (bypassing IK math)
                q_target = action_tensor.detach().numpy().flatten()
                ik_result = {"q": q_target, "converged": True}
                mode = "ai_inference"
            else:
                # Math Fallback Mode
                # We need a Cartesian target. Let's extract the wrist (first 3 features of 63-dim state)
                wrist_pos = self.last_state[0, :3].numpy() * 5.0
                target_pos = wrist_pos
                
                initial_q = np.array([0.0, 0.0, 0.0])
                ik_result = self.ik_solver.solve(initial_q, target_pos)
                mode = "math_fallback"
            
            # 5. Push to simulation and hardware
            if self.simulation.model is not None:
                q_pos_array = np.array([ik_result["q"][0]])
                self.simulation.set_joint_angles(q_pos_array)
                
            if hasattr(self, 'serial') and self.serial.is_connected:
                # Transmit the top 3 joints to physical Arduino
                if len(ik_result["q"]) >= 3:
                    self.serial.transmit_angles(ik_result["q"][:3])
            
            return {
                "status": "CONNECTED",
                "timestamp": time.time(),
                "mode": mode,
                "q_target": ik_result["q"].tolist()
            }
        except Exception as e:
            logger.error(f"Kernel Tick Error: {e}")
            return {"status": "ERROR", "error": str(e)}

    def inject_command(self, semantic_payload: dict):
        """Allows external APIs to inject LLM commands directly into the OS queue."""
        try:
            self.command_queue.put_nowait(semantic_payload)
            logger.info(f"Command injected: {semantic_payload}")
        except queue.Full:
            logger.warning("Command Queue is full! Dropping semantic command.")

    def shutdown(self):
        logger.info("Initiating Kernel shutdown sequence...")
        if hasattr(self, 'serial') and self.serial.is_connected:
            self.serial.disconnect()
        logger.info("Kernel safely halted.")
        # Gracefully kill background process
        try:
            self.frame_queue.put(None)
            self.perception_process.join(timeout=2)
            if self.perception_process.is_alive():
                self.perception_process.terminate()
                
            if hasattr(self, 'serial'):
                self.serial.close()
        except Exception:
            pass
