import os
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"
service_dir = os.path.join(base_dir, "services/robotics-service")

def write_file(path, content):
    full_path = os.path.join(service_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# Metadata
write_file("package.json", json.dumps({
  "name": "robotics-service",
  "version": "1.0.0",
  "description": "Robotics Runtime Layer",
  "private": True
}, indent=2))

write_file("requirements.txt", """fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
redis==5.0.4
""")

write_file("Dockerfile", """FROM ros:humble-ros-base

WORKDIR /app
RUN apt-get update && apt-get install -y python3-pip

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# We assume standard ROS setup is executed in entrypoint
COPY src/ ./src/

CMD ["/bin/bash", "-c", "source /opt/ros/humble/setup.bash && uvicorn src.main:app --host 0.0.0.0 --port 8001"]
""")

# 1. Main Runtime
write_file("src/main.py", """import asyncio
from fastapi import FastAPI
from .ros.bridge import ROS2Bridge
from .devices.adapters.simulated import SimulatedRobotAdapter
from .telemetry.redis_stream import TelemetryPublisher

app = FastAPI(title="SignVerse Robotics Service")
ros_bridge = ROS2Bridge()
telemetry_pub = TelemetryPublisher(redis_url="redis://localhost:6379")
robot_adapter = SimulatedRobotAdapter(ros_bridge, telemetry_pub)

@app.on_event("startup")
async def startup_event():
    ros_bridge.initialize()
    await robot_adapter.connect()

@app.on_event("shutdown")
async def shutdown_event():
    await robot_adapter.disconnect()
    ros_bridge.shutdown()

@app.get("/health")
async def health_check():
    return {"status": "online", "service": "robotics-service", "ros2": ros_bridge.is_initialized}

@app.post("/robot/command")
async def send_robot_command(command: dict):
    await robot_adapter.send_command(command)
    return {"status": "command_sent"}
""")

# 2. ROS2 Integration Layer
write_file("src/ros/schemas.py", """from pydantic import BaseModel
from typing import Any

class ROSMessage(BaseModel):
    topic: str
    timestamp: float
    payload: Any
""")

write_file("src/ros/bridge.py", """import threading
import time

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
    ROS_AVAILABLE = True
except ImportError:
    ROS_AVAILABLE = False
    class Node: pass

class ROS2Bridge(Node if ROS_AVAILABLE else object):
    def __init__(self):
        self.is_initialized = False
        if ROS_AVAILABLE:
            super().__init__('signverse_ros_bridge')
            self.publisher_ = self.create_publisher(String, '/cmd_vel', 10)
        
    def initialize(self):
        if not ROS_AVAILABLE:
            print("[ROS2Bridge] rclpy not found. Running in mock mode.")
            self.is_initialized = True
            return
            
        rclpy.init(args=None)
        self.is_initialized = True
        # Run ROS spin in background thread so FastAPI isn't blocked
        self._spin_thread = threading.Thread(target=self._spin, daemon=True)
        self._spin_thread.start()

    def _spin(self):
        rclpy.spin(self)

    def publish_command(self, command: dict):
        if not ROS_AVAILABLE:
            print(f"[ROS2Bridge Mock] Publishing to ROS: {command}")
            return
        msg = String()
        msg.data = str(command)
        self.publisher_.publish(msg)

    def shutdown(self):
        if ROS_AVAILABLE and self.is_initialized:
            self.destroy_node()
            rclpy.shutdown()
""")

# 3. Device Abstraction
write_file("src/devices/base.py", """from abc import ABC, abstractmethod
from typing import Any

class RoboticsDevice(ABC):
    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def send_command(self, command: dict) -> None:
        pass

    @abstractmethod
    async def get_telemetry(self) -> dict:
        pass
""")

write_file("src/devices/adapters/simulated.py", """import asyncio
import time
from ..base import RoboticsDevice
from ...ros.bridge import ROS2Bridge
from ...telemetry.redis_stream import TelemetryPublisher

class SimulatedRobotAdapter(RoboticsDevice):
    def __init__(self, ros_bridge: ROS2Bridge, telemetry_pub: TelemetryPublisher):
        self.ros_bridge = ros_bridge
        self.telemetry_pub = telemetry_pub
        self.connected = False
        self._telemetry_task = None

    async def connect(self) -> None:
        self.connected = True
        self._telemetry_task = asyncio.create_task(self._publish_loop())
        print("[SimulatedRobot] Connected.")

    async def disconnect(self) -> None:
        self.connected = False
        if self._telemetry_task:
            self._telemetry_task.cancel()
        print("[SimulatedRobot] Disconnected.")

    async def send_command(self, command: dict) -> None:
        if not self.connected:
            raise Exception("Robot not connected")
        # Forward to ROS
        self.ros_bridge.publish_command(command)

    async def get_telemetry(self) -> dict:
        return {
            "robotId": "sim_robot_001",
            "batteryLevel": 99.5,
            "cpuUsage": 12.0,
            "gpuUsage": 45.2,
            "temperature": 32.1,
            "timestamp": time.time()
        }

    async def _publish_loop(self):
        while self.connected:
            telemetry = await self.get_telemetry()
            await self.telemetry_pub.publish("robotics_telemetry", telemetry)
            await asyncio.sleep(0.1) # 10Hz telemetry
""")

# 4. Telemetry Integration
write_file("src/telemetry/redis_stream.py", """import json
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

class TelemetryPublisher:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_client = None
        if REDIS_AVAILABLE:
            self.redis_client = redis.from_url(redis_url)

    async def publish(self, stream_name: str, payload: dict):
        if not REDIS_AVAILABLE or not self.redis_client:
            # print(f"[Telemetry Mock] Publishing to {stream_name}: {payload}")
            return
        
        try:
            # Convert dict to string mapping for Redis XADD
            string_payload = {k: str(v) for k, v in payload.items()}
            await self.redis_client.xadd(stream_name, string_payload)
        except Exception as e:
            print(f"[TelemetryPublisher] Error publishing: {e}")
""")

print("Phase 4 Robotics Runtime (Sprint 1) scaffolded.")
