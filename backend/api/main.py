from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import time
import cv2
import numpy as np
from backend.websocket.manager import ConnectionManager

app = FastAPI(title="SignVerse Robotics OS API")

# Enable CORS for the dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    print("SignVerse OS Backend Initializing...")
    # Start async background telemetry loop
    asyncio.create_task(telemetry_loop())

async def telemetry_loop():
    """Background loop to broadcast SYSTEM_METRICS to all connected clients."""
    while True:
        payload = {
            "type": "SYSTEM_METRICS",
            "payload": {
                "status": "CONNECTED",
                "fps": 60,
                "gpu_vram_mb": 1420,
                "cpu_usage": 12.5,
                "latency_ms": 16,
                "timestamp": time.time()
            }
        }
        await manager.broadcast(json.dumps(payload), topic="telemetry")
        await asyncio.sleep(0.016) # ~60Hz

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket, topic="telemetry")
    try:
        while True:
            # We don't expect much from the client on telemetry, just keep alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic="telemetry")

from backend.inference.pose.engine import MediaPipeHolisticProvider
from backend.inference.retarget.solver import KinematicSolver
from backend.inference.gesture.engine import GestureEngine
from backend.robotics.manager import robot_bus
from backend.runtime.bus import os_bus
from backend.runtime.agents.planning_agent import PlanningAgent
from backend.autonomy.runtime import ecosystem_core
from backend.cloud.telemetry import cloud_uplink
from backend.swarm.fleet_manager import swarm_coordinator
from backend.genesis.cognition import genesis_core
import base64
import asyncio

pose_engine = MediaPipeHolisticProvider()
kinematics = KinematicSolver()
gesture_engine = GestureEngine()

# Initialize Agents
planning_agent = PlanningAgent()

@app.on_event("startup")
async def startup_event():
    print("Starting SignVerse Distributed Ecosystem...")
    
    # 1. Register Swarm Nodes
    swarm_coordinator.register_node("robot_alpha", ["ik_arm", "camera"])
    swarm_coordinator.register_node("robot_beta", ["mobile_base"])
    
    # 2. Start Subsystems
    await planning_agent.start()
    await ecosystem_core.start()
    await cloud_uplink.start()
    await genesis_core.start()

@app.websocket("/ws/capture")
async def websocket_capture(websocket: WebSocket):
    """Handles bidirectional video stream processing."""
    await manager.connect(websocket, topic="capture")
    try:
        while True:
            data = await websocket.receive_text()
            
            if data.startswith("data:image"):
                base64_data = data.split(",")[1]
                frame_bytes = base64.b64decode(base64_data)
                np_arr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if frame is not None:
                    # 1. Pose Perception
                    t0 = time.time()
                    results = pose_engine.detect(frame)
                    latency = int((time.time() - t0) * 1000)
                    
                    pose_list = results["pose_landmarks"].tolist() if results.get("pose_landmarks") is not None else []
                    
                    # 2. Kinematic Retargeting & Gesture Recognition
                    joint_angles = None
                    gesture_result = None
                    if pose_list:
                        joint_angles = kinematics.solve_ik_from_pose(pose_list)
                        gesture_result = gesture_engine.process_frame(pose_list)
                        
                        if joint_angles:
                            robot_bus.broadcast_pose(joint_angles)
                            
                        # Publish Gesture to the OS Bus for Cognitive Processing
                        if gesture_result:
                            await os_bus.publish("perception/gesture", {
                                "human_id": "human_0",
                                "gesture": gesture_result["gesture"],
                                "confidence": gesture_result["confidence"]
                            })
                    
                    response = {
                        "type": "POSE_FRAME",
                        "payload": {
                            "timestamp": time.time(),
                            "latency_ms": latency,
                            "pose": pose_list,
                            "angles": joint_angles,
                            "gesture": gesture_result,
                            "confidence": 0.95
                        }
                    }
                    await manager.send_personal_message(json.dumps(response), websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic="capture")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "SignVerse Robotics OS"}
