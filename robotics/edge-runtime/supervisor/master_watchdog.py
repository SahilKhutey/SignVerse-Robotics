"""
Master Watchdog / Supervisor.
Spawns and monitors isolated subprocesses. Restarts or triggers E-stops if they drop heartbeats.
"""
import time
import logging
import multiprocessing
import sys
import os
from typing import Dict, Optional

import importlib.util

# Fix module resolution for packages with hyphens
_edge_runtime_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _edge_runtime_path not in sys.path:
    sys.path.insert(0, _edge_runtime_path)

def load_edge_module(name: str, rel_path: str):
    path = os.path.join(_edge_runtime_path, rel_path)
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

# Load IPCBus and Nodes dynamically
IPCBus = load_edge_module("zmq_bus", "ipc/zmq_bus.py").IPCBus
InferenceNode = load_edge_module("inference_node", "services/inference/inference_node.py").InferenceNode
MotionNode = load_edge_module("motion_node", "services/motion/motion_node.py").MotionNode
TelemetryNode = load_edge_module("telemetry_node", "services/telemetry/telemetry_node.py").TelemetryNode
HardwareNode = load_edge_module("hardware_node", "services/hardware/hardware_node.py").HardwareNode

logger = logging.getLogger(__name__)

# Target functions for isolated processes
def start_inference_node():
    node = InferenceNode()
    try:
        node.start()
    except KeyboardInterrupt:
        node.stop()

def start_motion_node():
    node = MotionNode()
    try:
        node.start()
    except KeyboardInterrupt:
        node.stop()

def start_telemetry_node():
    node = TelemetryNode()
    try:
        node.start()
    except KeyboardInterrupt:
        node.stop()

def start_hardware_node():
    node = HardwareNode()
    try:
        node.start()
    except KeyboardInterrupt:
        node.stop()

class MasterWatchdog:
    """
    Subprocess orchestrator and heartbeat supervisor.
    Monitors process life states and inter-process heartbeats, triggering immediate hardware E-stop on failures.
    """
    def __init__(self, heartbeat_address: str = "tcp://127.0.0.1:5559",
                 heartbeat_timeout_s: float = 0.5):
        self.heartbeat_address = os.environ.get("HEARTBEAT_ADDR", heartbeat_address)
        self.heartbeat_timeout_s = heartbeat_timeout_s
        self.running = False
        
        self.bus = IPCBus()
        self.processes: Dict[str, multiprocessing.Process] = {}
        self.last_heartbeats: Dict[str, float] = {}

    def spawn_processes(self):
        """Spawn the service nodes as isolated OS processes."""
        self.processes["inference"] = multiprocessing.Process(target=start_inference_node, daemon=True)
        self.processes["motion"] = multiprocessing.Process(target=start_motion_node, daemon=True)
        self.processes["telemetry"] = multiprocessing.Process(target=start_telemetry_node, daemon=True)
        self.processes["hardware"] = multiprocessing.Process(target=start_hardware_node, daemon=True)
        
        for name, proc in self.processes.items():
            proc.start()
            logger.info(f"[Supervisor] Spawned {name} process (PID: {proc.pid})")
            
        # Register boot start time as initial heartbeat
        now = time.time()
        for name in self.processes.keys():
            self.last_heartbeats[name] = now + 1.0 # 1 second grace period for boot

    def check_heartbeats(self) -> bool:
        """
        Collect heartbeats and check if any node is dead or timed out.
        Returns False if a node failed the check.
        """
        # Receive any incoming heartbeats (non-blocking)
        requests = self.bus.poll_replies(timeout_ms=5)
        now = time.time()
        for addr, socket, req in requests:
            node_name = req.get("node")
            if node_name in self.last_heartbeats:
                self.last_heartbeats[node_name] = now
            self.bus.send_reply(socket, {"status": "ok"})
            
        # Validate node status
        for name, proc in self.processes.items():
            # Check 1: Process is physically alive
            if not proc.is_alive():
                logger.error(f"[Supervisor] Process '{name}' died unexpectedly!")
                return False
                
            # Check 2: Process has reported heartbeats
            last = self.last_heartbeats.get(name, 0.0)
            elapsed = now - last
            if elapsed > self.heartbeat_timeout_s:
                logger.error(f"[Supervisor] Node '{name}' heartbeat timed out! Last beat: {elapsed:.2f}s ago")
                return False
                
        return True

    def trigger_estop(self):
        """Directly notify hardware/motion nodes of E-stop override before killing them."""
        logger.critical("[Supervisor] Heartbeat lost! ENGAGING HARDWARE E-STOP.")
        
        # Connect and send estop command to Motion and Hardware Command ports
        # We wrap in try-catch to avoid blocking if the sockets are unreachable
        try:
            hw_cmd_addr = os.environ.get("HARDWARE_CMD_ADDR", "tcp://127.0.0.1:5553")
            self.bus.send_request(hw_cmd_addr, {"action": "estop"}, timeout_ms=50) # Hardware command
        except Exception:
            pass
            
        try:
            motion_cmd_addr = os.environ.get("MOTION_CMD_ADDR", "tcp://127.0.0.1:5552")
            self.bus.send_request(motion_cmd_addr, {"action": "estop"}, timeout_ms=50) # Motion command
        except Exception:
            pass

    def stop_processes(self):
        """Safely terminate all spawned subprocesses."""
        logger.info("[Supervisor] Terminating all service processes...")
        for name, proc in self.processes.items():
            if proc.is_alive():
                proc.terminate()
                proc.join(timeout=0.2)
                if proc.is_alive():
                    proc.kill()
                    proc.join()
                logger.info(f"[Supervisor] Process '{name}' stopped.")
        self.processes.clear()

    def run(self, max_runtime_s: Optional[float] = None):
        """Run the supervisor control loop."""
        self.running = True
        self.bus.setup_reply(self.heartbeat_address)
        
        self.spawn_processes()
        
        start_time = time.time()
        success = True
        
        last_gc_time = time.time()
        while self.running:
            # Check for max runtime limit (useful for testing)
            if max_runtime_s and (time.time() - start_time >= max_runtime_s):
                logger.info("[Supervisor] Maximum runtime reached in test mode.")
                break
                
            if not self.check_heartbeats():
                self.trigger_estop()
                success = False
                break
                
            # Periodic memory garbage collection and logging to prevent leaks
            now = time.time()
            if now - last_gc_time > 10.0:  # Run every 10 seconds
                import gc
                gc.collect()
                try:
                    import psutil
                    process = psutil.Process(os.getpid())
                    mem_mb = process.memory_info().rss / (1024 * 1024)
                    logger.info(f"[Supervisor] Memory footprint: {mem_mb:.2f} MB")
                except ImportError:
                    pass
                last_gc_time = now
                
            time.sleep(0.01) # Check loop rate (100Hz)
            
        self.stop_processes()
        self.bus.close()
        logger.info("Supervisor shut down completed.")
        return success

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("--- Starting Robotics Edge Runtime ---")
    watchdog = MasterWatchdog()
    # Runs for 3 seconds in standalone executable test mode
    success = watchdog.run(max_runtime_s=3.0)
    print(f"--- Edge Runtime Shutdown Safely (Success: {success}) ---")
