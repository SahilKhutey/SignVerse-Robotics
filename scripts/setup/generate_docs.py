import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# Main README.md
write_file("README.md", """# SignVerse Robotics

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
""")

# Documentation Pages
write_file("docs/01_ARCHITECTURE.md", """# SignVerse Architecture

Sign-Verse follows the **Infrastructure First, AI Second** philosophy. 
Data flows continuously from Left-to-Right across the message broker:

`RAW VIDEO` -> `INGESTION` -> `PERCEPTION` -> `KINEMATICS` -> `SIMULATION` -> `AI` -> `EXPORT`

### Data Structures
- All inter-service communication utilizes strict JSON payloads defined in `packages/motion-format/schema.py`.
- No service is allowed to communicate synchronously. All data passes through Redis `rq` queues.
""")

write_file("docs/02_PERCEPTION.md", """# Perception Pipeline

The Perception daemon utilizes headless OpenCV and MediaPipe Holistic. 
When multiple people are detected in a single frame, the system utilizes `YOLO` bounding boxes coupled with `ByteTrack` to assign persistent tracking IDs across occlusions.
""")

write_file("docs/03_KINEMATICS.md", """# Kinematics Engine

MediaPipe outputs 33 spatial `(x, y, z)` points. Robotic motors require Joint Angles (e.g. `Roll, Pitch, Yaw`).
The Kinematics service implements a `SkeletonNode` hierarchy, utilizing Forward and Inverse Kinematics to calculate the exact rotation matrix between connected bones, clamping to physical constraints to prevent hardware damage.
""")

write_file("docs/04_SIMULATION.md", """# MuJoCo Sim2Real

A perfectly mathematically solved motion might still fail in reality due to gravity, momentum, or collision. 
The simulation service loads the target `.xml` robot and physically "plays" the AI's joint commands into the actuators. The `collision_checker.py` analyzes `data.ncon` to ensure the robot does not physically intersect itself.
""")

write_file("docs/05_AI_RL.md", """# AI & Reinforcement Learning

Sign-Verse utilizes a dual-memory system (Short Term Ring Buffers & Long Term Vector Databases) alongside a PyTorch Transformer Decoder.
The system auto-regressively predicts the $T+1$ kinematic frame using a triangular mask to prevent future-peeking. The PPO Agent then optimizes this prediction against an external reward function.
""")

# Add standard .gitignore
write_file(".gitignore", """__pycache__/
*.py[cod]
*$py.class
*.so
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/
node_modules/
dist/
build/
*.npy
*.h5
uploads/
downloads/
exports/
""")

print("Documentation and structured README files created successfully.")
