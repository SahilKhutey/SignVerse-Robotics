# SignVerse Robotics

An AI Operating System for Motion Intelligence and Autonomous Robotics.

SignVerse is a distributed, microservice-based architecture designed to extract 3D human motion from raw RGB video streams, solve the physical inverse kinematics, synthesize new behaviors using PyTorch Transformers and Reinforcement Learning, and physically verify those motions in a MuJoCo sandbox before exporting them to physical robots or 3D engines (Blender/Unreal).

## Core Architecture

The OS is divided into specialized, decoupled microservices connected via a Redis message broker and deployed via Docker Compose:

1. **Ingestion Service**: Captures raw camera feeds, RTSP streams, YouTube URLs, and static images.
2. **Perception Service**: Runs YOLO ByteTrack (multi-person tracking) and MediaPipe to extract 33-point 3D skeletons.
3. **Kinematics Service**: Solves Inverse/Forward Kinematics, converting raw 3D dots into strict Parent-Child robotic joint rotations (Quaternions/Euler) with physical limits.
4. **AI/ML Service**: Houses the Foundation Models (Contrastive Learning, Causal Action Decoders) and the PPO Reinforcement Learning agents.
5. **Simulation Service**: A MuJoCo sandbox that verifies Sim2Real physics feasibility (collision detection, momentum).
6. **Export Service**: Encodes the generated trajectories into standard formats like `.bvh`, `.npy`, and `.gltf`.
7. **Dashboard Web**: A React-Three-Fiber WebGL frontend to visualize the live skeleton streams.

## Directory Structure

```
sign-verse-robotics/
├── apps/
│   └── dashboard-web/         # React/Vite UI
├── docs/                      # Extensive Documentation
├── packages/
│   └── motion-format/         # Canonical schemas
├── scripts/                   # CLI utils (run_training.py)
├── services/                  # The AI Daemons
│   ├── api-gateway/           # FastAPI entrypoint
│   ├── export-service/        # BVH/RL exporters
│   ├── ingestion-service/     # Video parsing
│   ├── kinematics-service/    # Physics math solvers
│   ├── perception-service/    # Computer Vision (YOLO/Mediapipe)
│   ├── ai-training-service/   # PyTorch ML Models
│   └── simulation-service/    # MuJoCo Engine
├── docker-compose.yml         # Container Orchestration
└── Makefile                   # Quick Developer Commands
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.10+
- Node.js (pnpm)

### Running the Backend Cluster
```bash
make build
make up
```
This automatically boots Redis, MongoDB, Qdrant, the API Gateway, and the Python Worker daemons.

### Running the Frontend UI
```bash
make front
```
Navigates to `apps/dashboard-web` and boots the React-Three-Fiber WebGL UI.

## License
Proprietary / Closed Source.
