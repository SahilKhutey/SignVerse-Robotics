from typing import Dict, Any
from state.authoritative_state import RobotState

class StateReconciler:
    """
    Manages synchronization between the edge runtime's authoritative state
    and external consumers (e.g. React/Three.js dashboards) after network reconnects.
    """
    def __init__(self, robot_state: RobotState):
        self.robot_state = robot_state

    def reconcile(self, client_last_timestamp: float) -> Dict[str, Any]:
        """
        Determine how to catch up the client based on their last received timestamp.
        
        Returns a sync dictionary:
          - {"status": "UP_TO_DATE"}
          - {"status": "REPLAY", "frames": [...] }
          - {"status": "FULL_SYNC", "state": current_state}
        """
        current_state = self.robot_state.get_current_state()
        
        # 1. Initial connection or no last timestamp
        if client_last_timestamp <= 0.0:
            return {
                "status": "FULL_SYNC",
                "state": current_state
            }

        # Retrieve history since last timestamp
        history = self.robot_state.get_history_since(client_last_timestamp)

        # 2. Up to date
        if not history:
            return {"status": "UP_TO_DATE"}

        # 3. Check for history gaps
        # If the oldest timestamp still in the buffer is newer than what the client has,
        # it means some frames fell off the ring buffer during the offline period.
        with self.robot_state._lock:
            buffer_list = list(self.robot_state._buffer)
            
        if buffer_list:
            oldest_timestamp = buffer_list[0]["timestamp"]
            if client_last_timestamp < oldest_timestamp:
                return {
                    "status": "FULL_SYNC",
                    "state": current_state
                }

        # 4. Replay missed frames
        return {
            "status": "REPLAY",
            "frames": history
        }

