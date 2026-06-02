# SignVerse Simulation & Generation Stack

This document details the Digital Twin, simulation tools, 3D Mujoco rendering pipelines, and data exporters.

For a comprehensive specifications layout across all 10 system layers, see [SYSTEMS.md](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/SYSTEMS.md).

---

## 1. Exporters and Data Serialization

*   **ROS2 JointState Exporter**: Serializes dynamic joint angles and velocities into ROS2 `sensor_msgs/msg/JointState` messages in [ros2_exporter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/ros/ros2_exporter.py) to publish to ROS2 control nodes.
*   **Universal Motion Format (SVMF)**: Exports unified Pydantic schemas in [svmf.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/packages/motion-format/svmf.py) to represent motion streams.
*   **PyTorch ML Loaders**: Compiles, compresses, and pads motion frame sequences in [builder.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/datasets/builder.py) to serve data for policy networks.

---

## 2. Next.js Simulation & Digital Twin Dashboard

*   **Demo Mode Panel**: An interactive dark-mode deck in [DemoMode.tsx](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/apps/dashboard-web/src/components/DemoMode.tsx) displaying the Digital Twin loop (physics frames, joint states, active telemetry).
*   **30 FPS Throttling**: Restricts data updates inside the Zustand store [signverse-store.ts](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/apps/dashboard-web/src/state/signverse-store.ts) to preserve web browser thread responsiveness under high telemetry rates (~100Hz).
