"""
Hardware Service Node.
Dedicated high-priority process for servo control, IO execution, and sensor feedback reads.
Runs an isolated 500Hz IO loop.
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

logger = logging.getLogger(__name__)

class HardwareNode:
    """
    Simulated Hardware Interface Node executing at 500Hz.
    Coordinates physical state updates, interpolation feedback, and instant emergency stop overrides.
    """
    def __init__(self, pub_address: str = "tcp://127.0.0.1:5557",
                 cmd_address: str = "tcp://127.0.0.1:5553",
                 sub_address: str = "tcp://127.0.0.1:5556",
                 heartbeat_address: str = "tcp://127.0.0.1:5559"):
        self.pub_address = os.environ.get("HARDWARE_PUB_ADDR", pub_address)
        self.cmd_address = os.environ.get("HARDWARE_CMD_ADDR", cmd_address)
        self.sub_address = os.environ.get("MOTION_PUB_ADDR", sub_address)
        self.heartbeat_address = os.environ.get("HEARTBEAT_ADDR", heartbeat_address)
        self.running = False
        self.estop_active = False
        
        self.bus = IPCBus()
        # Initial robot joint angles
        self.current_pose: List[float] = [0.0, 0.0, 0.0]
        self.target_pose: List[float] = [0.0, 0.0, 0.0]
        
    def start(self):
        """Start the high-frequency IO feedback loop."""
        self.running = True
        self.bus.setup_publisher(self.pub_address)
        self.bus.setup_subscriber([self.sub_address], ["motion_command"])
        self.bus.setup_reply(self.cmd_address)
        
        logger.info(f"Hardware Node active at 500Hz. CMD={self.cmd_address}, PUB={self.pub_address}")
        
        tick_interval = 0.002 # 500Hz
        last_heartbeat = 0.0
        
        while self.running:
            loop_start = time.perf_counter()
            
            # 1. Emit Heartbeat (10Hz)
            now = time.time()
            if now - last_heartbeat >= 0.1:
                try:
                    self.bus.send_request(self.heartbeat_address, {"node": "hardware", "timestamp": now}, timeout_ms=50)
                except Exception:
                    pass
                last_heartbeat = now
                
            # 2. Check direct admin control messages (REP)
            requests = self.bus.poll_replies(timeout_ms=0)
            for addr, socket, req in requests:
                action = req.get("action")
                if action == "ping":
                    self.bus.send_reply(socket, {"status": "pong", "estop": self.estop_active, "pose": self.current_pose})
                elif action == "estop":
                    self.estop_active = True
                    logger.critical("[HardwareNode] E-STOP trigger received.")
                    self.bus.send_reply(socket, {"status": "estop_engaged"})
                elif action == "reset_estop":
                    self.estop_active = False
                    logger.info("[HardwareNode] E-STOP reset received.")
                    self.bus.send_reply(socket, {"status": "estop_disengaged"})
                else:
                    self.bus.send_reply(socket, {"error": "Unknown command"})
                    
            # 3. Poll subscription for joint target angles
            msgs = self.bus.poll(timeout_ms=0)
            for topic, payload in msgs:
                if topic == "motion_command":
                    if payload.get("estop", False):
                        self.estop_active = True
                        logger.critical("[HardwareNode] CRITICAL: Emergency stop command received from motion bus.")
                    elif "estop" in payload and not payload.get("estop"):
                        self.estop_active = False
                        logger.info("[HardwareNode] Emergency stop disengaged via motion bus.")
                        
                    if not self.estop_active and "joint_angles" in payload:
                        joint_dict = payload["joint_angles"]
                        self.target_pose = [
                            joint_dict.get("shoulder_pitch_r", 0.0),
                            joint_dict.get("shoulder_yaw_r", 0.0),
                            joint_dict.get("elbow_flex_r", 0.0)
                        ]
                        
            # 4. Integrate/Simulate servo physical dynamics
            if self.estop_active:
                # Instant deceleration to zero velocity
                pass
            else:
                # Interpolate pose towards target pose (simulating 50ms joint response)
                for i in range(len(self.current_pose)):
                    diff = self.target_pose[i] - self.current_pose[i]
                    # Cap movement step to simulate realistic servo speed limits (max 0.1 rad per 2ms)
                    step = max(-0.1, min(0.1, diff * 0.2))
                    self.current_pose[i] += step
                    
            # 5. Publish current authoritative joint feedback
            self.bus.publish("hardware_telemetry", {
                "pose": self.current_pose,
                "estop": self.estop_active,
                "timestamp": time.time()
            })
            
            # 6. Sleep for 500Hz loop sync
            elapsed = time.perf_counter() - loop_start
            sleep_time = max(0.0, tick_interval - elapsed)
            time.sleep(sleep_time)

    def stop(self):
        """Clean terminate."""
        self.running = False
        self.bus.close()
        logger.info("Hardware Node stopped.")
