# SignVerse Core Robotics Engine

This document outlines the core robotics, kinematics, and motion fusion subsystems in SignVerse-Robotics.

For a comprehensive specifications layout across all 10 system layers, see [SYSTEMS.md](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/SYSTEMS.md).

---

## 1. Kinematics Pipeline

The kinematics subsystem calculates joints, coordinates, and orientations from input data:
*   **Forward Kinematics**: Traverses hierarchical skeletal joint segments defined in [forward_kinematics.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/kinematics/forward_kinematics.py), multiplying relative parent node rotations to compute final 3D joint coordinate matrices.
*   **Limb Euler Rotation Resolvers**: Derives angular states between adjoining bones inside [joint_angles.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/joint_angles.py).
*   **SLERP Orientation**: Employs unit quaternions to smoothly interpolate rotations without gimbal lock inside [quaternion_builder.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/quaternion_builder.py).

---

## 2. Motion Fusion Pipeline

Aggregates independent bounding boxes and landmark points into actor profiles:
*   **Hungarian Tracking Solver**: Maps bounding box frames using Intersection over Union (IoU) overlaps inside [temporal_tracker.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_fusion/temporal_tracker.py).
*   **3D Kalman Filters**: Smooths coordinate channels to clean up landmark outputs inside [kalman_filter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_fusion/kalman_filter.py).
*   **Symmetric Occlusion Recovery**: Estimates hidden coordinates by mirroring opposite joints (e.g. left hand matching right hand symmetry) inside [occlusion_recovery.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/core/robotics/retargeting/occlusion_recovery.py).
