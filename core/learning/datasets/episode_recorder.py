"""
Episode Recorder
================
Records live kernel telemetry into the training database in real-time.

Each recorded frame contains:
  - timestamp (unix float)
  - observation: raw 63-dim hand landmark vector
  - action:      predicted joint angles [J0, J1, J2] (from kernel tick)
  - expert:      retargeting q_target (used as BC label when mode == 'retargeted')
  - mode:        inference mode string
  - reward:      shaped reward computed by RewardModel

Thread-safety: The recorder uses a thread-safe queue and a dedicated
daemon writer thread so that the kernel hot-path is never blocked by
SQLite I/O.

Schema (SQLite):
  episodes(id, session_id, started_at)
  frames(id, episode_id, ts, obs_json, action_json, expert_json, mode, reward)
"""

from __future__ import annotations

import json
import logging
import queue
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np

from core.learning.reinforcement.reward_model import RewardModel, RewardBreakdown

log = logging.getLogger(__name__)


# ── Schema DDL ────────────────────────────────────────────────────────────────

_DDL = """
CREATE TABLE IF NOT EXISTS episodes (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    started_at  REAL NOT NULL,
    ended_at    REAL,
    frame_count INTEGER DEFAULT 0,
    is_fatigued INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS frames (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id    TEXT NOT NULL,
    ts            REAL NOT NULL,
    obs_json      TEXT,         -- flattened hand landmark vector (63 floats)
    action_json   TEXT,         -- predicted joint angles [J0, J1, J2]
    expert_json   TEXT,         -- retargeted / expert angles (BC label)
    mode          TEXT,
    reward        REAL,
    fatigue_score REAL DEFAULT 0.0,
    FOREIGN KEY (episode_id) REFERENCES episodes(id)
);

CREATE INDEX IF NOT EXISTS idx_frames_episode ON frames(episode_id);
CREATE INDEX IF NOT EXISTS idx_frames_ts      ON frames(ts);
"""

# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class FrameRecord:
    episode_id: str
    ts:         float
    obs:        np.ndarray          # (63,) hand landmarks
    action:     np.ndarray          # (3,)  predicted joints
    expert:     Optional[np.ndarray]  # (3,)  BC label
    mode:       str
    reward:     float
    fatigue_score: float = 0.0


# ── Recorder ──────────────────────────────────────────────────────────────────

class EpisodeRecorder:
    """
    Thread-safe live episode recorder.

    Typical kernel integration:
        recorder = EpisodeRecorder()
        recorder.start()
        ...
        recorder.begin_episode()
        recorder.record(obs, action, expert, mode)
        recorder.end_episode()
        recorder.stop()
    """

    QUEUE_MAXSIZE   = 4096
    FLUSH_INTERVAL  = 0.5    # seconds between batch flushes
    BATCH_SIZE      = 64     # max frames per INSERT batch

    def __init__(
        self,
        db_path:   str = "datasets/raw/teleoperation.db",
        session_id: Optional[str] = None,
    ):
        self.db_path    = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.session_id = session_id or str(uuid.uuid4())[:8]

        self._reward_model   = RewardModel()
        self._queue: queue.Queue[FrameRecord] = queue.Queue(maxsize=self.QUEUE_MAXSIZE)
        self._writer_thread: Optional[threading.Thread] = None
        self._stop_event     = threading.Event()
        self._episode_id: Optional[str] = None
        self._prev_action: Optional[np.ndarray] = None
        self._lock           = threading.Lock()

        self._is_paused      = False
        self._fatigued_flag  = False

        self._total_frames   = 0
        self._dropped_frames = 0

        self._init_db()

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self):
        """Start the background writer thread."""
        self._stop_event.clear()
        self._writer_thread = threading.Thread(
            target=self._writer_loop,
            name="episode-recorder-writer",
            daemon=True,
        )
        self._writer_thread.start()
        log.info("[EpisodeRecorder] started — session=%s db=%s", self.session_id, self.db_path)

    def stop(self):
        """Flush remaining frames and stop the writer thread."""
        self._stop_event.set()
        if self._writer_thread:
            self._writer_thread.join(timeout=5.0)
        log.info(
            "[EpisodeRecorder] stopped — frames=%d dropped=%d",
            self._total_frames, self._dropped_frames,
        )

    # ── Episode management ─────────────────────────────────────────────────────

    def begin_episode(self) -> str:
        """Start a new recording episode. Returns episode_id."""
        with self._lock:
            self._episode_id  = str(uuid.uuid4())
            self._prev_action = None
            self._is_paused   = False
            self._fatigued_flag = False

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO episodes(id, session_id, started_at) VALUES (?,?,?)",
                (self._episode_id, self.session_id, time.time()),
            )
            conn.commit()

        log.debug("[EpisodeRecorder] begin episode=%s", self._episode_id)
        return self._episode_id

    def pause_episode(self):
        """Pauses frame recording for the current episode."""
        with self._lock:
            self._is_paused = True
            self._fatigued_flag = True
            eid = self._episode_id

        if eid is not None:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("UPDATE episodes SET is_fatigued = 1 WHERE id = ?", (eid,))
                    conn.commit()
            except Exception as e:
                log.error(f"[EpisodeRecorder] Failed to flag episode as fatigued in DB: {e}")
        log.info("[EpisodeRecorder] paused episode=%s", eid)

    def resume_episode(self):
        """Resumes frame recording for the current episode."""
        with self._lock:
            self._is_paused = False
        log.info("[EpisodeRecorder] resumed episode=%s", self._episode_id)

    def end_episode(self):
        """Mark the current episode as complete."""
        with self._lock:
            eid = self._episode_id
            self._episode_id = None

        if eid is None:
            return

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE episodes SET ended_at=?, frame_count=("
                "  SELECT COUNT(*) FROM frames WHERE episode_id=?"
                ") WHERE id=?",
                (time.time(), eid, eid),
            )
            conn.commit()

        log.debug("[EpisodeRecorder] end episode=%s", eid)

    # ── Frame recording ────────────────────────────────────────────────────────

    def record(
        self,
        obs:    np.ndarray,
        action: np.ndarray,
        expert: Optional[np.ndarray] = None,
        mode:   str = "retargeted",
        fatigue_score: float = 0.0,
    ) -> Optional[RewardBreakdown]:
        """
        Record one frame and compute its shaped reward.

        Parameters
        ----------
        obs    : (63,) raw hand landmark features
        action : (3,)  predicted joint angles
        expert : (3,)  expert / retargeted joint angles (BC label)
        mode   : inference mode string
        fatigue_score : calculated operator fatigue score

        Returns
        -------
        RewardBreakdown or None if episode not started or paused.
        """
        with self._lock:
            eid        = self._episode_id
            prev_act   = self._prev_action
            is_paused  = self._is_paused

        if eid is None or is_paused:
            return None

        obs    = np.asarray(obs, dtype=np.float32).flatten()[:63]
        action = np.asarray(action, dtype=np.float32).flatten()[:3]
        if expert is not None:
            expert = np.asarray(expert, dtype=np.float32).flatten()[:3]

        # Compute shaped reward
        breakdown = self._reward_model.compute(
            state=obs, action=action, target=expert, prev_action=prev_act
        )

        frame = FrameRecord(
            episode_id=eid,
            ts=time.time(),
            obs=obs,
            action=action,
            expert=expert,
            mode=mode,
            reward=breakdown.total,
            fatigue_score=fatigue_score,
        )

        try:
            self._queue.put_nowait(frame)
        except queue.Full:
            self._dropped_frames += 1
            log.warning("[EpisodeRecorder] queue full — frame dropped")

        with self._lock:
            self._prev_action = action.copy()

        return breakdown

    # ── Stats ──────────────────────────────────────────────────────────────────

    @property
    def stats(self) -> Dict[str, int]:
        return {
            "total_frames":   self._total_frames,
            "dropped_frames": self._dropped_frames,
            "queue_size":     self._queue.qsize(),
        }

    # ── Internal ───────────────────────────────────────────────────────────────

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(_DDL)
            conn.commit()

        # Database migrations for existing databases
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("ALTER TABLE episodes ADD COLUMN is_fatigued INTEGER DEFAULT 0")
                conn.commit()
        except sqlite3.OperationalError:
            pass

        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("ALTER TABLE frames ADD COLUMN fatigue_score REAL DEFAULT 0.0")
                conn.commit()
        except sqlite3.OperationalError:
            pass

    def _writer_loop(self):
        """Background thread: drain queue and batch-insert into SQLite."""
        while not self._stop_event.is_set():
            self._flush_batch()
            self._stop_event.wait(timeout=self.FLUSH_INTERVAL)
        # Final flush
        self._flush_batch()

    def _flush_batch(self):
        batch: List[FrameRecord] = []
        try:
            while len(batch) < self.BATCH_SIZE:
                batch.append(self._queue.get_nowait())
        except queue.Empty:
            pass

        if not batch:
            return

        rows = [
            (
                f.episode_id,
                f.ts,
                json.dumps(f.obs.tolist()),
                json.dumps(f.action.tolist()),
                json.dumps(f.expert.tolist()) if f.expert is not None else None,
                f.mode,
                f.reward,
                f.fatigue_score,
            )
            for f in batch
        ]

        try:
            with sqlite3.connect(self.db_path, timeout=10.0) as conn:
                conn.executemany(
                    "INSERT INTO frames(episode_id,ts,obs_json,action_json,expert_json,mode,reward,fatigue_score)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    rows,
                )
                conn.commit()
            self._total_frames += len(batch)
        except sqlite3.Error as exc:
            log.error("[EpisodeRecorder] write error: %s", exc)
