import os
import pickle
import asyncio
import collections
from pathlib import Path
from typing import Any, Dict, List

from core.os.utils.logger import setup_logger

logger = setup_logger("ReplayBuffer")

class ReplayBuffer:
    def __init__(self, capacity: int = 500, persist_path: str = "data/replay_buffer.pkl"):
        self.capacity = capacity
        self.persist_path = persist_path
        self.buffer = collections.deque(maxlen=capacity)
        self.total_pushed = 0
        self.lock = asyncio.Lock()
        self.load_from_disk()

    def __len__(self):
        return len(self.buffer)

    async def push(self, entry: Dict[str, Any]):
        """Appends a new demo session entry to the ring buffer.
        
        Spawns a fire-and-forget async serialization task every 50 pushes.
        """
        async with self.lock:
            self.buffer.append(entry)
            self.total_pushed += 1
            
            if self.total_pushed % 50 == 0:
                # Fire-and-forget persist task
                asyncio.create_task(self._persist())

    async def sample(self, n: int) -> List[Dict[str, Any]]:
        """Uniformly samples n frames from the ring buffer.
        
        Increments times_sampled on each sampled entry.
        Flattens lists of TelemetryFrames.
        """
        async with self.lock:
            if not self.buffer:
                return []

            # Check total frames available
            total_frames = sum(len(entry.get("frames", [])) for entry in self.buffer)
            if total_frames < n:
                # Return all available frames
                logger.info(f"Buffer has {total_frames} frames which is less than requested {n}. Returning all.")
                all_frames = []
                for entry in self.buffer:
                    entry["times_sampled"] = entry.get("times_sampled", 0) + 1
                    all_frames.extend(entry.get("frames", []))
                return all_frames

            import random
            sampled_frames = []
            
            # Randomly select entries (with replacement if we need more than unique entries)
            sampled_entries = random.choices(list(self.buffer), k=n)
            
            seen_ids = set()
            for entry in sampled_entries:
                sess_id = entry.get("session_id")
                if sess_id not in seen_ids:
                    seen_ids.add(sess_id)
                    entry["times_sampled"] = entry.get("times_sampled", 0) + 1
                
            for entry in sampled_entries:
                frames = entry.get("frames", [])
                if frames:
                    sampled_frames.append(random.choice(frames))

            return sampled_frames

    async def snapshot(self) -> List[Dict[str, Any]]:
        """Returns metadata list of entries without raw frame data for API consumption."""
        async with self.lock:
            return [
                {
                    "session_id": entry.get("session_id"),
                    "label": entry.get("label"),
                    "added_at": entry.get("added_at"),
                    "times_sampled": entry.get("times_sampled", 0),
                    "frame_count": len(entry.get("frames", []))
                }
                for entry in self.buffer
            ]

    async def _persist(self):
        """Asynchronously triggers writing the buffer to disk."""
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.save_to_disk)

    def save_to_disk(self):
        """Pickles the deque to disk."""
        try:
            path = Path(self.persist_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "wb") as f:
                # Convert deque to list for pickle compatibility
                pickle.dump(list(self.buffer), f)
            logger.info(f"Replay buffer successfully persisted to disk: {self.persist_path}")
        except Exception as e:
            logger.error(f"Failed to persist replay buffer to disk: {e}")

    def load_from_disk(self):
        """Loads and inflates pickled deque from disk."""
        path = Path(self.persist_path)
        if path.exists():
            try:
                with open(path, "rb") as f:
                    data_list = pickle.load(f)
                    self.buffer = collections.deque(data_list, maxlen=self.capacity)
                logger.info(f"Replay buffer loaded from {self.persist_path} with {len(self.buffer)} entries.")
            except Exception as e:
                logger.error(f"Failed to load replay buffer from disk: {e}")
                self.buffer = collections.deque(maxlen=self.capacity)
