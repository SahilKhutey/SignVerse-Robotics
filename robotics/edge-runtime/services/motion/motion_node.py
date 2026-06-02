"""
Motion Service Node.
Manages trajectory interpolation, IK solving, self-collision validation, and joint limit enforcement.
Runs an isolated 200Hz tick loop.
"""
import time
import logging
import sys
import os
from typing import Dict, List, Optional

# Fix module resolution for packages with hyphens
_edge_runtime_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _edge_runtime_path not in sys.path:
    sys.path.insert(0, _edge_runtime_path)

from ipc.zmq_bus import IPCBus
from robotics.kinematics.inverse.ik_solver import solve_ik
from robotics.collision.self_collision import check_collision
from robotics.safety.motion_validator import validate_motion

logger = logging.getLogger(__name__)

class MotionNode:
    """
    Dedicated controller process running the 200Hz control loop.
    Solves kinematics and applies safety verification constraints before command transmission.
    """
    def __init__(self, pub_address: str = "tcp://127.0.0.1:5556",
                 cmd_address: str = "tcp://127.0.0.1:5552",
                 sub_addresses: Optional[List[str]] = None,
                 heartbeat_address: str = "tcp://127.0.0.1:5559"):
        self.pub_address = os.environ.get("MOTION_PUB_ADDR", pub_address)
        self.cmd_address = os.environ.get("MOTION_CMD_ADDR", cmd_address)
        # Subscribe to Inference Output (5555) and Hardware Telemetry (5557) by default
        self.sub_addresses = sub_addresses or [
            os.environ.get("INFERENCE_PUB_ADDR", "tcp://127.0.0.1:5555"),
            os.environ.get("HARDWARE_PUB_ADDR", "tcp://127.0.0.1:5557")
        ]
        self.heartbeat_address = os.environ.get("HEARTBEAT_ADDR", heartbeat_address)
        self.running = False
        self.estop_active = False
        
        self.bus = IPCBus()
        self.current_pose: List[float] = [0.0, 0.0, 0.0]
        self.last_target_time = 0.0
        self.last_latency_ms = 0.0

    def handle_incoming_data(self):
        """Poll for incoming feedback updates from hardware and landmarks from inference."""
        msgs = self.bus.poll(timeout_ms=0)
        for topic, payload in msgs:
            if topic == "hardware_telemetry":
                # Auth state tracking
                self.current_pose = payload.get("pose", [0.0, 0.0, 0.0])
            elif topic == "inference_output":
                # Automatically trigger IK target solving if not in E-stop
                if not self.estop_active and "output" in payload:
                    out_list = payload["output"]
                    # Map detection output vector back to IK target coordinates (x, y, z)
                    if len(out_list) >= 3:
                        target = {"x": out_list[0], "y": out_list[1], "z": out_list[2]}
                        self.process_motion_target(target)

    def process_motion_target(self, target: Dict[str, float]):
        """Solve IK, validate motion safety boundary constraints, and transmit commands."""
        if self.estop_active:
            logger.warning("[MotionNode] Motion blocked: E-stop is active.")
            return

        start_time = time.perf_counter()
        
        # 1. Solve Inverse Kinematics
        ik_res = solve_ik(target)
        joint_angles_dict = ik_res.get("joint_angles", {})
        
        # Extract joints list to validate
        joint_list = [
            joint_angles_dict.get("shoulder_pitch_r", 0.0),
            joint_angles_dict.get("shoulder_yaw_r", 0.0),
            joint_angles_dict.get("elbow_flex_r", 0.0)
        ]
        
        # 2. Collision checking
        colliding = check_collision(joint_list)
        if colliding:
            logger.error(f"[MotionNode] Trajectory aborted: Self-collision detected for pose {joint_list}")
            return
            
        # 3. Motion limits and step velocity check
        traj_to_validate = [self.current_pose, joint_list]
        motion_valid = validate_motion(traj_to_validate)
        if not motion_valid:
            logger.error(f"[MotionNode] Trajectory aborted: Joint limits or velocity delta violated.")
            return
            
        # 4. Transmit commands to Hardware Node
        self.bus.publish("motion_command", {
            "joint_angles": joint_angles_dict,
            "timestamp": time.time()
        })
        
        self.last_latency_ms = (time.perf_counter() - start_time) * 1000.0

    def start(self):
        """Start the high-frequency control loop process."""
        self.running = True
        self.bus.setup_publisher(self.pub_address)
        self.bus.setup_subscriber(self.sub_addresses, ["inference_output", "hardware_telemetry"])
        self.bus.setup_reply(self.cmd_address)
        
        logger.info(f"Motion Node active at 200Hz. CMD={self.cmd_address}, PUB={self.pub_address}")
        
        tick_interval = 0.005 # 200Hz
        last_heartbeat = 0.0
        
        while self.running:
            loop_start = time.perf_counter()
            
            # 1. Heartbeat report (10Hz)
            now = time.time()
            if now - last_heartbeat >= 0.1:
                try:
                    self.bus.send_request(self.heartbeat_address, {"node": "motion", "timestamp": now}, timeout_ms=50)
                except Exception:
                    pass
                last_heartbeat = now
                
            # 2. Process command requests (REP)
            requests = self.bus.poll_replies(timeout_ms=0)
            for addr, socket, req in requests:
                action = req.get("action")
                if action == "estop":
                    self.estop_active = True
                    # Immediately propagate E-stop command to hardware publisher
                    self.bus.publish("motion_command", {"estop": True, "timestamp": time.time()})
                    logger.critical("[MotionNode] CRITICAL: Estop state engaged via supervisor command.")
                    self.bus.send_reply(socket, {"status": "estop_engaged"})
                elif action == "reset_estop":
                    self.estop_active = False
                    self.bus.publish("motion_command", {"estop": False, "timestamp": time.time()})
                    logger.info("[MotionNode] Estop disengaged.")
                    self.bus.send_reply(socket, {"status": "estop_disengaged"})
                elif action == "solve":
                    target = req.get("target", {})
                    self.process_motion_target(target)
                    self.bus.send_reply(socket, {"status": "processed", "latency_ms": self.last_latency_ms})
                elif action == "ping":
                    self.bus.send_reply(socket, {"status": "pong", "estop": self.estop_active})
                else:
                    self.bus.send_reply(socket, {"error": "Unknown command"})

            # 3. Process subscriber updates (Feedback & Landmarks)
            self.handle_incoming_data()
            
            # 4. Synchronize loop execution frequency
            elapsed = time.perf_counter() - loop_start
            sleep_time = max(0.0, tick_interval - elapsed)
            time.sleep(sleep_time)

    def stop(self):
        """Terminate connection loop."""
        self.running = False
        self.bus.close()
        logger.info("Motion Node stopped.")
