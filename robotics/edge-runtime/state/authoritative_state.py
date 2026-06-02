import collections
import threading
import time
from typing import Dict, List, Optional, Any

class RobotState:
    """
    Single source of truth for the robot's physical configuration and status.
    Maintains a thread-safe ring buffer of the last 1000 snapshots (~5s of history at 200Hz)
    to support client synchronization and state reconciliation.
    """
    def __init__(self, max_buffer_size: int = 1000):
        self._lock = threading.Lock()
        self.max_buffer_size = max_buffer_size
        self._buffer = collections.deque(maxlen=max_buffer_size)
        self._current_state = {
            "timestamp": 0.0,
            "joints": {},
            "velocities": {},
            "status": "idle"
        }

    def update(self, joints: Dict[str, float], velocities: Optional[Dict[str, float]] = None, status: str = "active"):
        """Update the authoritative state and push a snapshot to the ring buffer."""
        with self._lock:
            now = time.time()
            self._current_state = {
                "timestamp": now,
                "joints": dict(joints),
                "velocities": dict(velocities) if velocities else {},
                "status": status
            }
            # Append a copy to prevent mutation issues
            self._buffer.append(dict(self._current_state))

    def get_current_state(self) -> Dict[str, Any]:
        """Return a copy of the current authoritative state."""
        with self._lock:
            return dict(self._current_state)

    def get_history_since(self, timestamp: float) -> List[Dict[str, Any]]:
        """Retrieve all state snapshots recorded strictly after the given timestamp."""
        with self._lock:
            return [snap for snap in self._buffer if snap["timestamp"] > timestamp]

    def clear(self):
        """Reset the state store and empty the buffer."""
        with self._lock:
            self._buffer.clear()
            self._current_state = {
                "timestamp": 0.0,
                "joints": {},
                "velocities": {},
                "status": "idle"
            }

