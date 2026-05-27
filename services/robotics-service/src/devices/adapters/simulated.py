import asyncio
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
