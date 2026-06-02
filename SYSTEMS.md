# SignVerse Systems Documentation

This document provides a comprehensive technical reference for the SignVerse-Robotics platform, covering the architecture, layer-by-layer details, mathematical models, data formats, real-time dashboard UI, and verification suites.

---

## 1. System Architecture Overview

SignVerse-Robotics is structured as a layered monorepo. It manages the ingestion of raw camera streams, extracts and fuses 3D skeletal data, estimates joints and velocities, segments skills using physical movement metrics, exports simulation datasets, and renders everything in a real-time web dashboard.

```
       +-------------------------------------------------------+
       |                  Layer 9: Dashboard                   |
       |     Next.js Web / XR Overlay / Telemetry Throttling    |
       +---------------------------+---------------------------+
                                   ^
                                   | WebSockets / JSON telemetry
       +---------------------------v---------------------------+
       |             Layer 7 & 8: Simulation & Dataset         |
       |       ROS2 Exporter / HDF5 / SVMF PyTorch Loaders     |
       +---------------------------+---------------------------+
                                   ^
                                   | SVMF (Universal Motion Format)
       +---------------------------v---------------------------+
       |             Layer 6: Motion Intelligence             |
       |    Action Segmenters / 128D Embedders / Tokenizers    |
       +---------------------------+---------------------------+
                                   ^
                                   | Cartesian Joint Angles / Velocities
       +---------------------------v---------------------------+
       |             Layer 4 & 5: Fusion & Kinematics          |
       |    Kalman Filters / Hungarian Tracker / forward FK   |
       +---------------------------+---------------------------+
                                   ^
                                   | Normalized Bounding Boxes & Landmarks
       +---------------------------v---------------------------+
       |            Layer 1, 2, 3: Ingestion & Perception      |
       |      RTSP Grabber / YOLO Detector / ONNX Quantizer    |
       +---------------------------+---------------------------+
                                   ^
                                   | Raw RTSP / USB Video Streams
       +---------------------------v---------------------------+
       |                Layer 0: Control Plane                 |
       |     Watchdog Daemon / WebSocket Queue Backpressures   |
       +-------------------------------------------------------+
```

---

## 2. Layer-by-Layer Subsystem Specifications

### Layer 0: Control Plane & Edge Supervisor
*   **Process Watchdog**: Evaluates edge-device process states inside [master_watchdog.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/robotics/edge-runtime/supervisor/master_watchdog.py). Utilizes periodic garbage collection (`gc.collect()`) and memory thresholds to prevent memory degradation.
*   **Gateway Backpressure Handling**: Configured in [gateway.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/deployment/api_gateway/gateway.py). Replaces standard blocking write loops with a ring-buffer strategy. If client buffers fill, older frames are dropped to maintain real-time low-latency synchronization.

### Layer 1 & 2: Ingestion & Stream Processing
*   **Multi-threaded Ingester**: Implemented in [rtsp_ingester.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/ingestion-service/streaming/rtsp_ingester.py). Spawns dedicated read threads to capture frames from RTSP camera sources using OpenCV, saving compressed base64 segments into Redis buffers.
*   **Image Stabilization**: Managed in [frame_extractor.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/ingestion-service/app/ffmpeg/frame_extractor.py). Performs sub-pixel translation alignment using phase correlation alongside bilinear resizing and Gaussian smoothing.

### Layer 3: Perception Layer
*   **Dynamic Quantizer**: Implemented in [quantize.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/perception-service/yolo/quantize.py). Formats ONNX model layers into static/dynamic `INT8` representations to speed up feed-forward neural net evaluations.
*   **Proximity Extraction**: Tracked in [object_detector.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/semantic-service/interactions/object_detector.py). Extracts Euclidean hand-to-object distances relative to coordinate anchors.

### Layer 4 & 5: Motion Fusion & Kinematics
*   **Hungarian Bounding-Box Matcher**: Solved in [temporal_tracker.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_fusion/temporal_tracker.py). Computes overlap metrics (Intersection over Union) to preserve actor track identities across frame streams.
*   **Kalman Filtering**: Defined in [kalman_filter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_fusion/kalman_filter.py). Uses coordinate matrices to smooth noisy landmark outputs across spatial dimensions.
*   **Symmetry Occlusion recovery**: Coded in [occlusion_recovery.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/retargeting/occlusion_recovery.py). Reconstructs obscured joint landmarks by mirroring high-confidence symmetric joints.
*   **Forward Kinematics Traversal**: Implemented in [forward_kinematics.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/kinematics/forward_kinematics.py). Traverses skeletal graph joints (parent nodes to children nodes) using matrix transformations.
*   **Joint Angles Resolver**: Built in [joint_angles.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/joint_angles.py). Evaluates Euler and hinge rotations between bone vectors.
*   **Quaternion Builders**: Configured in [quaternion_builder.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/quaternion_builder.py). Performs Spherical Linear Interpolation (SLERP) to smooth out joint rotations.

### Layer 6: Motion Intelligence
*   **Velocity/Acceleration Estimators**: Calculated in [velocity_estimator.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/velocity_estimator.py) and [acceleration_estimator.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/acceleration_estimator.py). Exposes kinematic derivatives using backward difference modeling smoothed via Exponential Moving Averages (EMA).
*   **Action Segmenter**: Defined in [action_segmenter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_intelligence/action_segmenter.py). Divides motions into discrete sections based on kinetic energy acceleration spikes.
*   **Skill Tokenizer & Classifier**: Evaluated in [skill_tokenizer.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/semantic-service/segmentation/skill_tokenizer.py). Discretizes movement speeds into primitives (`approach`, `reach`, `grasp`, `lift`).
*   **Motion Embeddings Generator**: Solved in [motion_embeddings.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_intelligence/motion_embeddings.py). Converts joint statistics into 128-dimensional unit normalized vectors.

### Layer 7 & 8: Simulation Export & Dataset packaging
*   **ROS2 Joint State Exporter**: Handled in [ros2_exporter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/ros/ros2_exporter.py). Publishes serialized joint trajectories to ROS2 `sensor_msgs/msg/JointState` channels.
*   **Universal Motion Format (SVMF)**: Implemented in [svmf.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/packages/motion-format/svmf.py). Imposes strict Pydantic structures on physical movement sequences.
*   **PyTorch Dataset Loader**: Created in [builder.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/datasets/builder.py) as `SVMFDataset`. Features zero-mean unit-variance scaling, coordinate clipping, and padding to expose motion datasets to ML models.

### Layer 9: Dashboard UI & Demo Mode
*   **UI Update Throttling**: Implemented in [signverse-store.ts](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/apps/dashboard-web/src/state/signverse-store.ts). Restricts state updates to ~30 FPS, preventing canvas locking during high-frequency telemetry.
*   **Socket Reconnection Handshake**: Handled via local timestamp indicators (`lastFrameTs`), allowing state reconciliation after dropouts.
*   **Demo Mode Control Deck**: Built inside [DemoMode.tsx](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/apps/dashboard-web/src/components/DemoMode.tsx). Exposes a glowing dark-mode display with real-time digital-twin SVG models and timeline controls.

---

## 3. Mathematical Foundations

### Spherical Linear Interpolation (SLERP)
To resolve orientations without gimbal lock, SignVerse leverages unit quaternion SLERP interpolation. Given two quaternions $q_0$ and $q_1$, and parameter $t \in [0, 1]$:

$$\Omega = \arccos(q_0 \cdot q_1)$$

$$\text{SLERP}(q_0, q_1, t) = \frac{\sin((1-t)\Omega)}{\sin\Omega}q_0 + \frac{\sin(t\Omega)}{\sin\Omega}q_1$$

This formulation is implemented inside [quaternion_builder.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/quaternion_builder.py).

### Vectorized Kalman Filtering
Filtering out observation noise in joint locations is computed via 3D linear Kalman equations inside [kalman_filter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_fusion/kalman_filter.py):

$$\mathbf{x}_{k|k-1} = \mathbf{F}\mathbf{x}_{k-1|k-1}$$

$$\mathbf{P}_{k|k-1} = \mathbf{F}\mathbf{P}_{k-1|k-1}\mathbf{F}^T + \mathbf{Q}$$

$$\mathbf{K}_k = \mathbf{P}_{k|k-1}\mathbf{H}^T (\mathbf{H}\mathbf{P}_{k|k-1}\mathbf{H}^T + \mathbf{R})^{-1}$$

$$\mathbf{x}_{k|k} = \mathbf{x}_{k|k-1} + \mathbf{K}_k(\mathbf{z}_k - \mathbf{H}\mathbf{x}_{k|k-1})$$

$$\mathbf{P}_{k|k} = (\mathbf{I} - \mathbf{K}_k\mathbf{H})\mathbf{P}_{k|k-1}$$

---

## 4. Subsystem File Layout

```
sign-verse-robotics/
├── ai/
│   └── tokenization/
│       └── motion_tokenizer.py    # Quantization token mapping
├── apps/
│   └── dashboard-web/
│       └── src/
│           ├── components/
│           │   ├── DemoMode.tsx    # Responsive simulation screens
│           │   └── SystemMetricsBar.tsx
│           └── state/
│               └── signverse-store.ts # Web telemetry Zustand store
├── core/
│   ├── deployment/
│   │   └── api_gateway/
│   │       └── gateway.py          # WebSocket backpressure handling
│   └── robotics/
│       ├── kinematics/
│       │   └── forward_kinematics.py # Skeletal hierarchical traversals
│       ├── retargeting/
│       │   └── occlusion_recovery.py # Mirror symmetry occlusions
│       └── ros/
│           └── ros2_exporter.py    # Serialized ROS2 JointState channel
├── datasets/
│   └── builder.py                  # PyTorch SVMF dataset builders
├── kinematics/
│   ├── joint_angles.py             # Euler limb derivations
│   ├── quaternion_builder.py       # SLERP orientation interpolation
│   ├── velocity_estimator.py       # Backward differentiation velocity
│   └── acceleration_estimator.py   # Double difference acceleration
├── motion_fusion/
│   ├── temporal_tracker.py         # Hungarian track matching
│   ├── kalman_filter.py            # Coordinate landmark filtering
│   ├── identity_manager.py         # Actor tracks profiling
│   └── skeleton_fusion.py          # Weighted coordinate averages
├── motion_intelligence/
│   ├── action_segmenter.py         # Kinetic energy segmentation
│   ├── skill_extractor.py          # Symbolic skill parser
│   └── motion_embeddings.py        # 128D statistical moments vectors
└── packages/
    └── motion-format/
        └── svmf.py                 # Pydantic SVMF definitions
```

---

## 5. Verification Framework

Verification is partitioned into two major executing scopes to ensure zero runtime regressions:

### A. Regression Suite (`testing/`)
Maintains regression tests covering overall AI pipelines, diagnostics recorders, and stress bounds under high-frequency telemetry.
*   **Run command**: `python -m pytest testing/`
*   **Skips elimination**: Features safe NaN-handling and thread-safe mock EStop interface components to ensure **0 skips**.

### B. Core Application Suite (`tests/`)
Asserts numerical solver outputs, dataset packaging, and local API gateway configurations.
*   **Run command**: `python -m pytest tests/` inside `sign-verse-robotics/`
