# SignVerse Robotics OS

**SignVerse** is an advanced, multidisciplinary "Universal Human → Robot Motion Intelligence Platform."
It bridges the gap between raw human kinematic data (via teleoperation) and autonomous robotic execution through a sophisticated Python-based operating system.

## Core Features

1. **Real-time Teleoperation**: Captures human movements instantly via WebCam using MediaPipe Holistic Tracking.
2. **Behavior Cloning (AI)**: Includes a full PyTorch pipeline to train an `ActionPolicyNetwork` from SQLite databases, learning to convert human kinematics into robot joint angles.
3. **Cognitive Reasoning**: Integrates LangChain LLM Agents to parse natural language commands (e.g., "Pick up the block") into structured robotic intents and required skills.
4. **Digital Twin Web Dashboard**: A professional-grade, glassmorphic React/Three.js command center. It visualizes the real-time telemetry array from the OS and mathematically articulates a 3D robot arm matching the AI's predicted movements at 60 FPS.
5. **High-Speed Architecture**: Designed around a 1000Hz master control loop (`SignVerseKernel`) with asynchronous FastAPI WebSocket bridges.

## System Architecture

The architecture relies strictly on modular separation of concerns under the `core/` directory:

- **`core/perception`**: WebCam streaming, MediaPipe Landmark detection.
- **`core/robotics`**: Inverse Kinematics (IK), MuJoCo Integration, Coordinate tracking.
- **`core/learning`**: The 'Brain'. Behavior Cloning (Imitation Learning) PyTorch pipelines.
- **`core/cognition`**: The 'Mind'. LangChain-powered Semantic Parsing (`MotionReasoner`).
- **`core/deployment`**: The 'Nervous System'. FastAPI, REST routes, WebSocket connections.
- **`core/os`**: The 'Heart'. `SignVerseKernel` orchestrating the 1000Hz tick loop.

## Quickstart Guide

### 1. The Core Robotics OS
Run the main FastAPI Gateway. This boots up the OS kernel, initializes the ML models, loads the LangChain cognitive agents, and opens the WebSockets.
```bash
uvicorn core.deployment.api_gateway.gateway:app --reload
```

### 2. The 3D Digital Twin Dashboard
Launch the React Front-End to interact with the OS visually.
```bash
cd ui/dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173`. You can type natural language commands to the AI or watch the robot telemetry stream.

### 3. Data Collection (Teleoperation)
To record yourself moving and build the Behavior Cloning dataset:
```bash
python scripts/data_collector.py
```
Press `r` to record sessions. Data is stored in `datasets/raw/` (Images + JSON) and indexed in `teleoperation.db`.

### 4. Behavior Cloning Training
To train the PyTorch Network on your newly collected data:
```bash
$env:PYTHONPATH = (Get-Location).Path; python scripts/train.py
```
This exports optimized weights to `core/learning/models/policy_latest.pth`.

## Development Roadmap
- **Phase 1-8**: Perception & Robotics Grounding *(Complete)*
- **Phase 9-13**: Digital Twin Integration *(Complete)*
- **Phase 14-17**: LLM Cognition & Imitation Learning *(Complete)*
- **Next Steps**: Hardware edge-deployment to physical ESP32/Arduino robotic chassis.
