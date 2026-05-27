# Sign-Verse Robotics: Architecture Strategy

For Sign-Verse Robotics, a modular monorepo is the strongest starting architecture — but not a “single giant tightly-coupled repo.”

Your system is not a normal app. It is:
- Computer Vision Platform
- Realtime Streaming System
- Simulation Infrastructure
- Robotics Pipeline
- AI Research Stack
- Dataset Platform
- 3D Engine Integration
- Distributed GPU System

That changes the repo strategy completely.

## Recommended Architecture Strategy

**Hybrid Modular Monorepo → Eventually Distributed Platform**

This is the optimal path.

### Why Pure Microservices Too Early Is Dangerous

If you immediately split into 20 repos, 40 services, and independent deployments, you will create:
- dependency chaos
- schema drift
- duplicated types
- broken pipelines
- version mismatch
- GPU orchestration nightmares
- impossible debugging
- slower research iteration

For an AI + CV + Robotics platform, this becomes extremely painful. Especially because the pipeline stages (Pose → Kinematics → Semantics → Retargeting → Simulation → Export) are deeply interconnected.

### Why One Massive Codebase Also Fails

A single giant backend becomes:
- impossible to scale
- hard to deploy
- slow CI/CD
- GPU bottlenecks
- tightly coupled inference
- difficult experimentation

especially with realtime streaming, heavy AI models, Blender integration, RL pipelines, and robotics simulators.

### Best Solution: Modular Monorepo

This provides:
- **Shared schemas**: Skeletons, joints, motion formats
- **Shared ML pipelines**: Reusable perception stack
- **Shared types**: Frontend ↔ Backend synchronization
- **Unified CI/CD**: Easier deployment
- **Faster iteration**: Critical for AI research
- **Easier debugging**: End-to-end visibility
- **Internal package reuse**: Math, kinematics, rendering
- **Central orchestration**: GPU workers easier
- **Version consistency**: Huge for motion datasets

## What Your Architecture Should Become

### Stage 1 — Modular Monorepo (NOW)
Best for rapid development, architecture stabilization, schema evolution, AI experimentation, and dashboard development.
**Structure**:
- `apps/`
- `services/`
- `packages/`
- `ai/`
- `infrastructure/`

### Stage 2 — Internal Platform Services
Later split deployment-wise into Perception Workers, Kinematics Workers, Streaming Workers, Simulation Workers, and Training Workers, BUT still inside the same monorepo. This is the ideal middle stage.

### Stage 3 — Distributed GPU Infrastructure
Later split into Inference Cluster, Realtime Cluster, Training Cluster, Simulation Cluster, and Export Cluster. Still connected through shared contracts.

### Stage 4 — Selective Repo Extraction (ONLY WHEN NEEDED)
Only after stabilization extract specific candidates:
- `dashboard-web`: independent frontend
- `ai-research`: isolated experimentation
- `robotics-sdk`: public SDK
- `mobile-app`: mobile release cycle
NOT before.

## Recommended Internal Architecture

Use **“Domain-Driven Modular Architecture”**.
Instead of `frontend/` and `backend/`, use `perception/`, `motion/`, `robotics/`, `simulation/`, `exports/`, and `datasets/` because the platform is domain-heavy.

## Recommended Stack Architecture

### 1. Monorepo Tooling
- **Turborepo**: Best overall
- **Nx**: Good alternative
- **pnpm workspaces**: Strongly recommended

### 2. Backend Architecture
Use **FastAPI + Python workers + Redis queues + gRPC**. (NOT a Django monolith).

### 3. Realtime Architecture
Use **WebSockets** and **Redis Streams** (Kafka later).

### 4. AI Inference Architecture
Separate:
- Realtime inference
- Batch inference
- Training
- Research
VERY important.

### 5. GPU Architecture
Critical for scale. You need a **GPU Worker Pool** (NOT a single inference server).

### 6. Storage Architecture
You should NOT store everything in PostgreSQL.
- **PostgreSQL**: metadata
- **MongoDB**: motion documents
- **MinIO/S3**: videos/assets
- **Redis**: realtime
- **Qdrant/Weaviate**: embeddings

### 7. AI Research Isolation
Research code must NOT pollute production pipelines.
**Correct structure**: `ai/research/` vs `ai/production/`.

## Recommended Communication Architecture

### Internal Service Communication
- **REST APIs**: Use for dashboard APIs, dataset queries, admin systems.
- **WebSockets**: Use for realtime pose streaming, live overlays, dashboards.
- **gRPC**: Use for service-to-service GPU communication (critical later).
- **Redis Queue**: Use for video ingestion, pose processing, batch exports, training jobs.

## Recommended Deployment Architecture
- **Development**: Docker Compose
- **Production**: Kubernetes (later).

## Recommended AI Architecture

You actually need TWO AI stacks.
- **Stack A — Production AI**: Optimised (TensorRT, ONNX, low latency, realtime inference).
- **Stack B — Research AI**: Flexible (PyTorch, Jupyter, experimentation). Keep separated.

## Most Important Architectural Decision
**Treat Motion as a Universal Data Layer.**
This is the key insight. Your true core is NOT pose estimation; it is universal motion representation. That changes schemas, databases, exports, robotics, simulation, and AI training.

## Recommended Final Architecture Style
**AI Operating System for Motion Intelligence**
Not a CV app. Not a robotics app. But a Motion Intelligence Infrastructure Platform.

## Final Recommendation
**BEST CHOICE RIGHT NOW**
✅ Modular Monorepo
✅ Domain-driven architecture
✅ Shared schemas/types/contracts
✅ Service-oriented internal structure
✅ Distributed workers
✅ Queue-based orchestration
✅ Separate AI research stack
✅ GPU worker architecture
✅ Event-driven pipelines

**DO NOT START WITH**
❌ many independent repos
❌ microservices everywhere
❌ giant monolithic backend
❌ tightly coupled AI pipelines
❌ synchronous-only processing
❌ frontend/backend-only structure

**Ideal Evolution Path**
`Modular Monorepo` → `Internal Service Platform` → `Distributed GPU Platform` → `Motion Intelligence Infrastructure` → `Embodied AI Operating System`
