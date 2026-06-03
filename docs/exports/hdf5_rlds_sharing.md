# Live Remote Observation & Dataset Sharing

This document describes the design, schema specification, and signaling protocols for exporting teleoperation session datasets (HDF5 and RLDS) and live remote digital twin streaming.

---

## 1. Session Dataset Exporters

The API Gateway supports exporting sqlite-recorded teleoperation session demonstrations to standardized machine learning dataset formats via:
`GET /api/sessions/{id}/export?format={hdf5|rlds}`

Both formats return a binary HDF5 container (`.h5`) tailored to standard robot imitation learning frameworks.

### A. RoboMimic & LeRobot HDF5 Format (`format=hdf5`)

For compatibility with standard open-source robotics imitation learning repositories (such as LeRobot, RoboMimic, and ACT), the exporter creates an HDF5 dataset structure with the following layouts:

- **`/joint_angles`** ($N \times 7$ float32): Contains the sequence of executed joints in radians. The physical arm J0-J2 angles are placed in the first three columns, and the remaining 4 columns are padded with zeros to conform to standard 7-DOF kinematic inputs.
- **`/timestamps`** ($N$ float64): UNIX timestamps for each frame.
- **`/observations`** ($N \times 63$ float32): Raw MediaPipe hand landmarks (21 landmarks $\times$ 3D coordinate values) representing the tracking inputs.
- **`/rewards`** ($N$ float32): Shaped imitation reward scores computed by the RewardModel.
- **`/session_metadata`** (group): Key-value attributes describing the episode profile:
  - `id`: Session UUID.
  - `session_label`: Assigned task name.
  - `frame_count`: Sequence length.
  - `is_fatigued`: Integer flag indicating if the session was paused/flagged due to biometric fatigue.
  - `duration`: Calculated elapsed duration in seconds.

### B. Reinforcement Learning Datasets (RLDS) Format (`format=rlds`)

Enables direct ingestion into TFDS (TensorFlow Datasets) pipeline specifications and Google Research behavior cloning repositories. The exporter structures step-by-step state arrays at the root level of the HDF5 file:

- **`/observation`** ($N \times 63$ float32): Multi-dimensional tracking landmark inputs.
- **`/action`** ($N \times 7$ float32): $N \times 7$ joint angle actions (padded with zeros).
- **`/reward`** ($N$ float32): Frame-by-frame shaped environment rewards.
- **`/discount`** ($N$ float32): Constant discount factor (set to `1.0`).
- **`/is_first`** ($N$ bool): Boolean array where index 0 is `True` and other indexes are `False`.
- **`/is_last`** ($N$ bool): Boolean array where index $N-1$ is `True` and other indexes are `False`.
- **`/is_terminal`** ($N$ bool): Boolean array where index $N-1$ is `True` and other indexes are `False`.
- **`/session_metadata`** (group): Metadata details identical to the HDF5 export format.

---

## 2. Live Session Remote Observation (WebRTC)

Allows multiple remote team members to view the 3D twin live in real-time, operating under a secure token handshake and low-latency P2P channel.

### A. Protocol Handshake & WebRTC Signaling
1. **Token Generation**: The operator dashboard makes an authenticated request to `POST /api/share/start` to retrieve a secure, 1-hour active share token.
2. **WebSocket Signaling Route**: Both operator and observer connect to `/ws/observe?token=...&role={operator|observer}`. The backend coordinates message routing between client roles.
3. **P2P Connection Set Up**:
   - When an observer connects, the backend notifies the operator (`observer_connected`).
   - The operator creates a `RTCPeerConnection` and opens a WebRTC `RTCDataChannel` named `"telemetry"` configured with `{ ordered: false, maxRetransmits: 0 }` for fast, real-time packet distribution.
   - SDP offers, SDP answers, and ICE candidates are exchanged between the operator and observer browsers via the WebSocket signaling channel.
   - Once the WebRTC state transitions to `connected`, the operator streams 60Hz telemetry joints directly to the observer.

### B. Graceful WebSocket Fallback Relay
- In restricted network environments where firewalls or NAT configurations block direct P2P connections, the signaling channel serves as a fallback.
- The operator checks the `readyState` of the observer's data channel. If it is not `open`, it sends telemetry frames directly to the signaling WebSocket.
- The backend relays these packets to the observer as `telemetry` frames, ensuring that live observation remains functional on all network layouts.

---

## 3. Remote Observer View Client (`/observe`)

Remote observers open the link `http://localhost:3000/observe?token=<token>` to access the observation deck:
- **Standalone Layout**: Renders directly on screen, bypassing default operator sidebar navigation tabs for safety and visual minimalism.
- **Read-Only Lock**: All interactive modules (E-Stops, motor triggers, playback decks, NLP script commands) are entirely deactivated to prevent unauthorized hardware adjustments.
- **Live Diagnostics Overlay**: Displays pulsing connection status labels, current transmission transports (DataChannel vs WS Relay), and live WebRTC statistics (RTT latencies, packet loss, jitter).
