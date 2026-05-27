import asyncio
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
