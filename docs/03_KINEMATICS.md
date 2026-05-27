# Kinematics Engine

MediaPipe outputs 33 spatial `(x, y, z)` points. Robotic motors require Joint Angles (e.g. `Roll, Pitch, Yaw`).
The Kinematics service implements a `SkeletonNode` hierarchy, utilizing Forward and Inverse Kinematics to calculate the exact rotation matrix between connected bones, clamping to physical constraints to prevent hardware damage.
