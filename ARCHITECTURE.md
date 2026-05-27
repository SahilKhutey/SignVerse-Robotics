# SignVerse System Architecture

## Monorepo Layout
- `apps/`: User-facing web and native apps (Dashboards, XR Overlays).
- `services/`: Scalable FastAPI backend microservices (Inference, Robotics, Auth).
- `engines/`: Core heavy-lifting runtimes (Simulation Physics, Digital Twins).
- `packages/`: Shared TS/Python UI components, schemas, and linting configs.
- `edge-runtime/`: ARM64 optimized code meant specifically for Jetson/Pi deployment.
- `infrastructure/`: Terraform, Kubernetes, Kong, and Vault deployment manifests.
- `research/`: Isolated sandboxes for neural interfaces and world-model experiments.
