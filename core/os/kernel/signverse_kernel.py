import numpy as np
import torch
import multiprocessing as mp
import queue
import time
import sys
import os

# Dynamic path injection for robotics/edge-runtime state
kernel_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.abspath(os.path.join(kernel_dir, "..", "..", "..", ".."))
edge_runtime_path = os.path.join(workspace_root, "robotics", "edge-runtime")
if edge_runtime_path not in sys.path:
    sys.path.insert(0, edge_runtime_path)

from state.authoritative_state import RobotState
from state.reconciliation import StateReconciler

from core.perception.providers.mediapipe_provider import MediaPipeHolisticProvider
from core.learning.models.behavior_cloning import BehaviorCloningMLP
from core.robotics.kinematics.inverse_kinematics import InverseKinematicsSolver
from core.robotics.simulation.mujoco_exporter import MuJoCoBridge
from core.robotics.control.serial_bridge import SerialBridge
from core.robotics.retargeting.pipeline import MotionRetargetingPipeline
from core.learning.imitation.training_orchestrator import TrainingOrchestrator
from core.os.utils.logger import setup_logger

logger = setup_logger("SignVerseKernel")

def _perception_worker(frame_queue, state_queue):
    """Background process for running MediaPipe (GIL isolated).
    
    Pushes a tuple (bc_state_tensor, pose_landmarks) so the kernel can
    drive both the AI policy (BC-MLP) and the retargeting pipeline from
    a single perception result.
    """
    perception = MediaPipeHolisticProvider(static_image_mode=False)
    while True:
        try:
            frame = frame_queue.get()
            if frame is None:
                break
            landmarks = perception.detect(frame)

            # ── BC-MLP input: 63-dim right-hand tensor ────────────────
            state_tensor = torch.zeros(1, 63)
            right_hand = landmarks.get("right_hand_landmarks") if landmarks else None
            if right_hand is not None and hasattr(right_hand, "shape"):
                if right_hand.shape == (21, 3):
                    state_tensor = torch.tensor(
                        right_hand.flatten(), dtype=torch.float32
                    ).unsqueeze(0)

            # ── Retargeting input: 33-point body pose ─────────────────
            pose_landmarks = landmarks.get("pose_landmarks") if landmarks else None

            payload = (state_tensor, pose_landmarks)

            # Keep only the freshest payload
            try:
                state_queue.put_nowait(payload)
            except queue.Full:
                state_queue.get_nowait()
                state_queue.put_nowait(payload)

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

        self.last_state = torch.zeros(1, 63)       # Seed BC-MLP state
        self.last_pose_landmarks = None            # Seed retargeting state
        
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

        # 5. Authoritative State & Reconciler
        self.robot_state = RobotState()
        self.reconciler = StateReconciler(self.robot_state)
        self.is_shutdown = False

        # 6. Motion Retargeting Pipeline
        self.retargeting = MotionRetargetingPipeline(
            process_noise=1e-2,
            measurement_noise=1e-1,
            enable_smoothing=True,
        )

        # 7. Online Training Orchestrator (non-blocking background thread)
        self.orchestrator = TrainingOrchestrator()
        self.orchestrator.start()
        self.orchestrator.recorder.begin_episode()
        logger.info("Training Orchestrator: STARTED")

    def tick(self, frame: np.ndarray) -> bool:
        """
        Executes one real-time cycle of the SignVerse OS asynchronously.
        Returns True if successful.
        """
        if self.is_shutdown:
            return {"status": "SHUTDOWN"}
        try:
            # 1. Push frame to background perception (non-blocking)
            try:
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                pass # Drop frame if perception is lagging
                
            # 2. Pull freshest perception payload (non-blocking)
            try:
                payload = self.state_queue.get_nowait()
                # Payload is (bc_state_tensor, pose_landmarks)
                if isinstance(payload, tuple) and len(payload) == 2:
                    self.last_state, self.last_pose_landmarks = payload
                else:
                    # Legacy fallback: plain tensor
                    self.last_state = payload
            except queue.Empty:
                pass  # Use last known state if perception is still processing
            
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
                            
                    # Update authoritative RobotState
                    q = ik_result["q"]
                    joints_dict = {
                        "J0": float(q[0]) if len(q) > 0 else 0.0,
                        "J1": float(q[1]) if len(q) > 1 else 0.0,
                        "J2": float(q[2]) if len(q) > 2 else 0.0,
                    }
                    self.robot_state.update(joints_dict, status="active")
                    current_state_snap = self.robot_state.get_current_state()

                    return {
                        "status": "CONNECTED",
                        "timestamp": current_state_snap["timestamp"],
                        "mode": "cognitive_override",
                        "q_target": q.tolist(),
                        "last_update": current_state_snap["timestamp"]
                    }
            except queue.Empty:
                pass
            
            # 3 & 4. Dual-Mode Kinematics (AI Inference vs Math Fallback)
            # ── Weight hot-swap: reload if orchestrator trained new weights ──
            if self.orchestrator.new_weights_available:
                try:
                    from core.learning.imitation.behavior_cloning import BCTrainerConfig
                    with torch.serialization.safe_globals([BCTrainerConfig]):
                        ckpt = torch.load(
                            self.orchestrator.best_checkpoint_path,
                            map_location="cpu",
                            weights_only=True,
                        )
                    self.policy.load_state_dict(ckpt["model"])
                    self.policy.eval()
                    self.use_ai = True
                    self.orchestrator.acknowledge_new_weights()
                    logger.info("[Kernel] hot-swapped AI policy weights")
                except Exception as _e:
                    logger.warning("[Kernel] weight hot-swap failed: %s", _e)

            if self.use_ai:
                with torch.no_grad():
                    action_tensor = self.policy(self.last_state)
                # AI directly predicts joint angles (bypassing IK math)
                q_target = action_tensor.detach().numpy().flatten()
                ik_result = {"q": q_target, "converged": True}
                mode = "ai_inference"
            else:
                # Retargeting + Math Fallback Mode
                # Run the full retargeting pipeline on the latest pose landmarks
                retarget_result = self.retargeting.process(self.last_pose_landmarks)

                if retarget_result["valid"]:
                    # Use retargeted joint angles directly (bypasses IK)
                    r_joints = retarget_result["joints"]
                    q_target = np.array([
                        r_joints.get("J0", 0.0),
                        r_joints.get("J1", 0.0),
                        r_joints.get("J2", 0.0),
                    ])
                    ik_result = {"q": q_target, "converged": True}
                    mode = "retargeted"
                else:
                    # Pure IK fallback when no landmarks available
                    wrist_pos = self.last_state[0, :3].numpy() * 5.0
                    initial_q = np.array([0.0, 0.0, 0.0])
                    ik_result = self.ik_solver.solve(initial_q, wrist_pos)
                    retarget_result = {"violations": [], "source_angles": {}}
                    mode = "math_fallback"
            
            # 5. Push to simulation and hardware
            if self.simulation.model is not None:
                q_pos_array = np.array([ik_result["q"][0]])
                self.simulation.set_joint_angles(q_pos_array)
                
            if hasattr(self, 'serial') and self.serial.is_connected:
                # Transmit the top 3 joints to physical Arduino
                if len(ik_result["q"]) >= 3:
                    self.serial.transmit_angles(ik_result["q"][:3])
            
            # Update authoritative RobotState
            q = ik_result["q"]
            joints_dict = {
                "J0": float(q[0]) if len(q) > 0 else 0.0,
                "J1": float(q[1]) if len(q) > 1 else 0.0,
                "J2": float(q[2]) if len(q) > 2 else 0.0,
            }
            self.robot_state.update(joints_dict, status="active")
            current_state_snap = self.robot_state.get_current_state()

            # ── Record frame for online training ──────────────────────────
            obs_np = self.last_state.detach().numpy().flatten()
            expert = q if mode == "retargeted" else None
            self.orchestrator.recorder.record(
                obs=obs_np,
                action=q,
                expert=expert,
                mode=mode,
            )

            return {
                "status": "CONNECTED",
                "timestamp": current_state_snap["timestamp"],
                "mode": mode,
                "q_target": q.tolist(),
                "last_update": current_state_snap["timestamp"],
                "retargeting": {
                    "violations": retarget_result.get("violations", []) if mode != "ai_inference" else [],
                    "source_angles": retarget_result.get("source_angles", {}) if mode != "ai_inference" else {},
                    "smoothed": retarget_result.get("smoothed", False) if mode != "ai_inference" else False,
                }
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
        self.is_shutdown = True
        logger.info("Initiating Kernel shutdown sequence...")

        # Stop online training and flush recorder
        try:
            self.orchestrator.recorder.end_episode()
            self.orchestrator.stop()
            logger.info("Training Orchestrator: STOPPED")
        except Exception as _e:
            logger.warning("Error stopping orchestrator: %s", _e)

        try:
            if hasattr(self, 'serial') and self.serial.is_connected:
                self.serial.close()
        except Exception as e:
            logger.warning(f"Error closing serial: {e}")
        logger.info("Kernel safely halted.")
        # Gracefully kill background process
        try:
            self.frame_queue.put(None, block=False)
            self.perception_process.join(timeout=1)
            if self.perception_process.is_alive():
                self.perception_process.terminate()
        except Exception:
            pass

        # Close queues and cancel join threads to prevent hanging on process exit
        for q in [self.frame_queue, self.state_queue, self.command_queue]:
            try:
                q.close()
                q.cancel_join_thread()
            except Exception:
                pass

