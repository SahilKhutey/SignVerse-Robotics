# Sign-Verse Robotics — Complete Monorepo & System Directory Structure

```text
sign-verse-robotics/
│
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── ROADMAP.md
├── ARCHITECTURE.md
├── SYSTEMS.md
├── CORE.md
├── WORKFLOW.md
├── TECH-STACK.md
├── DATABASE-SCHEMA.md
├── INTELLIGENCE-STACKS.md
├── MACHINE-LEARNING.md
├── PERCEPTION-SKELETON-OVERLAY.md
├── SIMULATION-GENERATION-2D-3D.md
├── BLENDER-3D-EXPORTS.md
│
├── docs/
│   │
│   ├── architecture/
│   │   ├── distributed-systems.md
│   │   ├── gpu-pipeline.md
│   │   ├── streaming-architecture.md
│   │   ├── event-driven-system.md
│   │   ├── orchestration.md
│   │   ├── deployment-topology.md
│   │   └── scaling-strategy.md
│   │
│   ├── perception/
│   │   ├── pose-estimation.md
│   │   ├── face-tracking.md
│   │   ├── hand-tracking.md
│   │   ├── segmentation.md
│   │   ├── multi-person-tracking.md
│   │   ├── motion-fusion.md
│   │   └── temporal-intelligence.md
│   │
│   ├── robotics/
│   │   ├── retargeting.md
│   │   ├── ik-fk.md
│   │   ├── mujoco.md
│   │   ├── ros2.md
│   │   ├── isaac-sim.md
│   │   ├── policy-learning.md
│   │   └── imitation-learning.md
│   │
│   ├── datasets/
│   │   ├── dataset-standards.md
│   │   ├── motion-schema.md
│   │   ├── annotation-system.md
│   │   ├── metadata-specification.md
│   │   ├── dataset-versioning.md
│   │   └── embeddings.md
│   │
│   ├── exports/
│   │   ├── blender.md
│   │   ├── unreal.md
│   │   ├── unity.md
│   │   ├── gltf.md
│   │   ├── fbx.md
│   │   ├── bvh.md
│   │   └── usd.md
│   │
│   ├── dashboard/
│   │   ├── ui-ux.md
│   │   ├── capture-studio.md
│   │   ├── dataset-manager.md
│   │   ├── 3d-viewer.md
│   │   ├── timeline-editor.md
│   │   ├── simulation-panel.md
│   │   └── analytics.md
│   │
│   ├── ai/
│   │   ├── motion-transformers.md
│   │   ├── embeddings.md
│   │   ├── semantic-understanding.md
│   │   ├── action-recognition.md
│   │   ├── intent-recognition.md
│   │   └── embodied-ai.md
│   │
│   └── api/
│       ├── rest-api.md
│       ├── websocket-api.md
│       ├── grpc-services.md
│       ├── auth.md
│       ├── queues.md
│       └── sdk.md
│
├── apps/
│   │
│   ├── dashboard-web/
│   │   │
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── pages/
│   │   │   ├── layouts/
│   │   │   ├── routes/
│   │   │   ├── components/
│   │   │   │   ├── capture/
│   │   │   │   ├── perception/
│   │   │   │   ├── overlays/
│   │   │   │   ├── viewers/
│   │   │   │   ├── timelines/
│   │   │   │   ├── robotics/
│   │   │   │   ├── exports/
│   │   │   │   ├── analytics/
│   │   │   │   └── ui/
│   │   │   │
│   │   │   ├── services/
│   │   │   ├── websocket/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── shaders/
│   │   │   ├── workers/
│   │   │   ├── three/
│   │   │   ├── simulations/
│   │   │   └── utils/
│   │   │
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── dashboard-desktop/
│   │   ├── electron/
│   │   ├── native-streaming/
│   │   ├── camera-drivers/
│   │   └── local-processing/
│   │
│   ├── mobile-app/
│   │   ├── android/
│   │   ├── ios/
│   │   ├── shared/
│   │   └── realtime-streaming/
│   │
│   └── admin-panel/
│       ├── monitoring/
│       ├── datasets/
│       ├── gpu-workers/
│       ├── pipelines/
│       └── analytics/
│
├── services/
│   │
│   ├── api-gateway/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── auth/
│   │   ├── websocket/
│   │   ├── grpc/
│   │   ├── validation/
│   │   └── rate-limits/
│   │
│   ├── orchestration-service/
│   │   ├── scheduler/
│   │   ├── workers/
│   │   ├── queues/
│   │   ├── events/
│   │   ├── state-machine/
│   │   └── gpu-manager/
│   │
│   ├── ingestion-service/
│   │   │
│   │   ├── camera/
│   │   │   ├── usb-camera/
│   │   │   ├── ip-camera/
│   │   │   ├── rtsp/
│   │   │   ├── webcam/
│   │   │   └── drone-streams/
│   │   │
│   │   ├── uploads/
│   │   │   ├── image-upload/
│   │   │   ├── video-upload/
│   │   │   ├── batch-upload/
│   │   │   └── drag-drop/
│   │   │
│   │   ├── youtube/
│   │   │   ├── youtube-downloader/
│   │   │   ├── youtube-stream-parser/
│   │   │   ├── metadata-fetcher/
│   │   │   └── frame-extractor/
│   │   │
│   │   ├── urls/
│   │   │   ├── remote-video/
│   │   │   ├── signed-urls/
│   │   │   └── streaming-inputs/
│   │   │
│   │   ├── frame-processing/
│   │   ├── fps-normalization/
│   │   ├── temporal-buffer/
│   │   ├── metadata/
│   │   └── ffmpeg/
│   │
│   ├── perception-service/
│   │   │
│   │   ├── human-detection/
│   │   ├── animal-detection/
│   │   ├── pose-estimation/
│   │   │   ├── mediapipe/
│   │   │   ├── openpose/
│   │   │   ├── movenet/
│   │   │   └── hybrid-pose/
│   │   │
│   │   ├── hand-tracking/
│   │   ├── face-tracking/
│   │   ├── gaze-estimation/
│   │   ├── expression-analysis/
│   │   ├── segmentation/
│   │   ├── depth-estimation/
│   │   ├── tracking/
│   │   │   ├── bytetrack/
│   │   │   ├── deepsort/
│   │   │   └── multi-camera-tracking/
│   │   │
│   │   ├── object-detection/
│   │   └── fusion/
│   │
│   ├── motion-fusion-service/
│   │   ├── kalman-filters/
│   │   ├── temporal-smoothing/
│   │   ├── occlusion-recovery/
│   │   ├── identity-persistence/
│   │   ├── motion-interpolation/
│   │   └── skeleton-fusion/
│   │
│   ├── kinematics-service/
│   │   ├── skeleton-graphs/
│   │   ├── quaternion-engine/
│   │   ├── euler-conversion/
│   │   ├── ik-solvers/
│   │   ├── fk-solvers/
│   │   ├── bone-normalization/
│   │   ├── constraints/
│   │   └── dynamics/
│   │
│   ├── semantic-intelligence-service/
│   │   ├── action-recognition/
│   │   ├── interaction-understanding/
│   │   ├── skill-extraction/
│   │   ├── motion-segmentation/
│   │   ├── transformers/
│   │   ├── embeddings/
│   │   ├── similarity-search/
│   │   └── intent-models/
│   │
│   ├── simulation-service/
│   │   ├── simulation-2d/
│   │   ├── simulation-3d/
│   │   ├── physics/
│   │   ├── collision/
│   │   ├── environments/
│   │   ├── replay-engine/
│   │   ├── scene-generation/
│   │   └── synthetic-data/
│   │
│   ├── overlay-service/
│   │   ├── skeleton-overlay/
│   │   ├── face-overlay/
│   │   ├── hand-overlay/
│   │   ├── heatmaps/
│   │   ├── confidence-overlay/
│   │   ├── interaction-overlay/
│   │   └── webgl-renderer/
│   │
│   ├── export-service/
│   │   ├── blender/
│   │   ├── unreal/
│   │   ├── unity/
│   │   ├── fbx/
│   │   ├── bvh/
│   │   ├── gltf/
│   │   ├── usd/
│   │   ├── ros2/
│   │   ├── mujoco/
│   │   ├── isaac/
│   │   └── rl-trajectories/
│   │
│   ├── robotics-service/
│   │   ├── retargeting/
│   │   ├── morphology-mapping/
│   │   ├── humanoids/
│   │   ├── quadrupeds/
│   │   ├── imitation-learning/
│   │   ├── policy-generation/
│   │   ├── ros2/
│   │   └── control-systems/
│   │
│   ├── dataset-service/
│   │   ├── dataset-builder/
│   │   ├── annotation/
│   │   ├── versioning/
│   │   ├── embeddings/
│   │   ├── indexing/
│   │   ├── search/
│   │   ├── validation/
│   │   └── compression/
│   │
│   ├── streaming-service/
│   │   ├── websocket-streams/
│   │   ├── realtime-inference/
│   │   ├── low-latency-pipeline/
│   │   ├── adaptive-streaming/
│   │   └── synchronization/
│   │
│   ├── ai-training-service/
│   │   ├── motion-transformers/
│   │   ├── gnn/
│   │   ├── sequence-models/
│   │   ├── rl-training/
│   │   ├── imitation-learning/
│   │   ├── evaluation/
│   │   └── benchmarks/
│   │
│   └── monitoring-service/
│       ├── gpu-monitoring/
│       ├── metrics/
│       ├── logs/
│       ├── tracing/
│       ├── analytics/
│       └── alerts/
│
├── packages/
│   │
│   ├── shared-types/
│   ├── shared-schemas/
│   ├── motion-types/
│   ├── skeleton-types/
│   ├── websocket-contracts/
│   ├── event-contracts/
│   ├── api-sdk/
│   ├── ui-components/
│   ├── shaders/
│   ├── motion-utils/
│   ├── geometry-utils/
│   ├── quaternion-utils/
│   ├── math-engine/
│   ├── physics-utils/
│   ├── ai-utils/
│   └── config/
│
├── ai/
│   │
│   ├── models/
│   │   ├── pose/
│   │   ├── hands/
│   │   ├── face/
│   │   ├── segmentation/
│   │   ├── detection/
│   │   ├── action/
│   │   ├── transformers/
│   │   └── embeddings/
│   │
│   ├── training/
│   │   ├── datasets/
│   │   ├── preprocessing/
│   │   ├── augmentation/
│   │   ├── trainers/
│   │   ├── evaluation/
│   │   └── checkpoints/
│   │
│   ├── inference/
│   │   ├── realtime/
│   │   ├── batch/
│   │   ├── gpu/
│   │   ├── onnx/
│   │   └── tensorrt/
│   │
│   └── research/
│       ├── embodied-ai/
│       ├── motion-foundation-models/
│       ├── motion-transformers/
│       ├── semantic-motion/
│       └── robotics-learning/
│
├── datasets/
│   │
│   ├── raw/
│   ├── processed/
│   ├── normalized/
│   ├── annotations/
│   ├── embeddings/
│   ├── synthetic/
│   ├── exports/
│   ├── benchmarks/
│   └── manifests/
│
├── storage/
│   │
│   ├── videos/
│   ├── frames/
│   ├── skeletons/
│   ├── simulations/
│   ├── exports/
│   ├── robotics/
│   ├── models/
│   └── cache/
│
├── infrastructure/
│   │
│   ├── docker/
│   ├── kubernetes/
│   ├── terraform/
│   ├── nginx/
│   ├── gpu-workers/
│   ├── redis/
│   ├── postgres/
│   ├── mongodb/
│   ├── minio/
│   ├── qdrant/
│   └── monitoring/
│
├── scripts/
│   ├── setup/
│   ├── migrations/
│   ├── downloads/
│   ├── model-installs/
│   ├── ffmpeg/
│   ├── deployment/
│   ├── testing/
│   └── benchmarks/
│
├── configs/
│   ├── development/
│   ├── staging/
│   ├── production/
│   ├── gpu/
│   ├── models/
│   ├── streaming/
│   └── exports/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── perception/
│   ├── robotics/
│   ├── exports/
│   ├── streaming/
│   └── simulations/
│
├── benchmarks/
│   ├── pose-estimation/
│   ├── tracking/
│   ├── latency/
│   ├── gpu/
│   ├── robotics/
│   └── simulations/
│
└── examples/
    ├── live-camera/
    ├── youtube-ingestion/
    ├── multi-camera/
    ├── robotics-retargeting/
    ├── blender-export/
    ├── unreal-export/
    ├── rl-dataset/
    └── realtime-dashboard/
```
