# Sign-Verse Robotics Intelligence System

This documentation describes the core systems, architecture, and implementation details for the robotic control and intelligence features developed in Sign-Verse.

---

## 1. Sim-to-Real Transfer & Teleoperation
Bridges the gap between simulated physics environments and real hardware execution to ensure safety and policy reliability.

### Core Concepts & Pipeline
- **MuJoCo Simulation**: Runs a twin environment (`core/simulation/mujoco_env.py`) side-by-side with real-time teleoperation.
- **Safety Checker**: Actuator signals are validated against collision geometry limit constraints (checking `data.ncon` intersections) before passing to active robot controllers.
- **Trajectory Comparison**: Computes divergence metrics (dynamic time warping/mean absolute error) between simulated trajectories and hardware feedback to detect joint overshoot or torque issues.
- **API Endpoint**: `POST /api/sim/run` triggers policy simulation with initial configuration poses.

---

## 2. Online Imitation Learning (BC)
Performs continuous, real-time fine-tuning of the Behavior Cloning policy as new human teleoperation demonstrations are recorded.

### Pipeline & Architecture
- **Weight Fine-Tuning**: A PyTorch Behavior Cloning model undergoes single-step batch gradient updates immediately upon session completion.
- **Catastrophic Forgetting Mitigation**: Implements a localized Replay Buffer mixed with Elastic Weight Consolidation (EWC) penalties. Old experiences are replayed alongside new demonstrations to stabilize neural network weights.
- **Visual Diagnostics**: Frontend monitors track live validation accuracy fluctuations and the status of the training replay buffers.

---

## 3. Reinforcement Learning from Human Feedback (RLHF)
Aligns predicted trajectories to operator preferences through preference labeling and PPO optimization.

### Three-Model Architecture
1. **Imitation Policy (Behavior Cloning)**: Serves as the starting actor policy.
2. **Preference Reward Model**: A secondary network trained via pairwise binary cross-entropy on human operator choices (comparing trajectory $A$ vs trajectory $B$).
3. **PPO Fine-Tuning Engine**: Updates the imitation policy parameters based on the learned preference reward signals.
- **Frontend Components**: Includes `PreferenceComparisonView` for side-by-side trajectory playback and reward charts monitoring PPO optimization progress.

---

## 4. Voice Command Integration
Enables hands-free command center operations using natural language processing over voice input.

### Web Speech API Pipeline
- **SpeechRecognition**: Recognizes operator microphone input directly in-browser.
- **Interim Transcripts**: Displays active, raw speech text in the input bar in real-time.
- **Waveform Canvas**: A 10-bar amplitude waveform visualization dynamically scaling with microphone volume levels.
- **NLP Router**: Auto-submits transcription text to the LangChain LLM execution gateway.

---

## 5. VR / AR Operator Mode
Provides fully immersive teleoperation utilizing spatial computing headsets.

### Low-Latency Constraints
- **Telemetry Gate**: The operator poses are mapped to joint angles and transmitted via WebSockets to the API gateway.
- **Latency Budget**: Must operate within a **<20ms** end-to-end loop (sensor capturing to visual rendering). If round-trip latency exceeds the budget, fallback mechanisms downsample data channels or notify the operator of tracking desynchronization.
- **UI Dashboard**: Displays the real-time round-trip latency and active transport logs.

---

## 6. Biometric Fatigue Detection
Protects data quality by checking the operator's physical state during telemetry recording.

### MediaPipe Eye and Head Landmarks
- **Eye Aspect Ratio (EAR)**: Computes distance ratios between vertical and horizontal eye points. EAR values falling below `0.2` indicate micro-sleeps or excessive blink periods.
- **Head Droop**: Measures the nose-to-eye height ratio to calculate head pitch.
- **Velocity Drop**: Checks hands movement speed. Slow/jittery landmarks trigger fatigue warning flags.
- **Auto-Stop Trigger**: If fatigue thresholds are breached for consecutive frames, telemetry recording automatically pauses and prompts the user to safeguard the dataset.

---

## 7. Multi-User Observation & Exporters
Allows team members to securely monitor live telemetry streams and download training-ready datasets.

### Dataset Exporters
- **HDF5 Exporter (`/api/sessions/{id}/export?format=hdf5`)**: Outputs standard h5py databases formatted for RoboMimic/LeRobot pipelines.
- **RLDS Exporter (`/api/sessions/{id}/export?format=rlds`)**: Structures tf.data-ready steps with `is_first`, `is_last`, and `is_terminal` boolean flags for TensorFlow training.
- **WebRTC Signaling Relay**: Coordinates Peer-to-Peer data channels for 60Hz observer streams with dynamic WebSocket fallbacks.
