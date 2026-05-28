"""
SignVerse Long-Term Memory Stack — Phase 10.1
==============================================
Embodied AI persistent memory system.

Memory Types:
  Episodic   → Specific experiences: missions, failures, interactions
  Semantic   → World knowledge: object types, spatial knowledge, concepts
  Procedural → Learned behaviors: optimized routines, skill sequences

Architecture:
  Experience → Encoder → Qdrant Vector Store
                       → LangGraph State Graph
                       → Temporal Datastore

Integration:
  - Qdrant:    Semantic similarity search over memory embeddings
  - LangGraph: Stateful reasoning chains across memory contexts
  - SQLite:    Structured episodic + procedural storage (local)
"""

import json
import sqlite3
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class MemoryType(Enum):
    EPISODIC   = "episodic"
    SEMANTIC   = "semantic"
    PROCEDURAL = "procedural"


class MemoryImportance(Enum):
    LOW      = 1
    MEDIUM   = 2
    HIGH     = 3
    CRITICAL = 4   # Never forgotten, always retrieved


@dataclass
class MemoryRecord:
    """A single memory record stored in the long-term memory stack."""
    memory_id: str
    memory_type: MemoryType
    importance: MemoryImportance
    content: dict                      # Structured content (event, object, skill)
    summary: str                       # Human-readable summary (for LLM context)
    tags: list[str]                    # Searchable semantic tags
    robot_id: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    access_count: int = 0
    embedding: Optional[list[float]] = None   # Vector embedding (Qdrant)


@dataclass
class EpisodicMemory(MemoryRecord):
    """A specific robot experience: mission, interaction, or failure."""
    outcome: str = "unknown"           # "success" | "failure" | "partial"
    location: Optional[dict] = None
    involved_entities: list[str] = field(default_factory=list)
    duration_s: float = 0.0


@dataclass
class SemanticMemory(MemoryRecord):
    """A learned world concept or object classification."""
    concept_type: str = "object"       # "object" | "place" | "person" | "event"
    attributes: dict = field(default_factory=dict)
    confidence: float = 1.0


@dataclass
class ProceduralMemory(MemoryRecord):
    """A learned skill or optimized behavior sequence."""
    skill_name: str = ""
    action_steps: list[dict] = field(default_factory=list)
    success_rate: float = 1.0
    avg_duration_s: float = 0.0


class LongTermMemoryStack:
    """
    Persistent long-term memory engine for SignVerse robots.

    Stores and retrieves:
      - Episodic: what happened, where, and with what outcome
      - Semantic: what things are and how they relate
      - Procedural: how to do things efficiently

    Uses SQLite for structured storage (Qdrant integration point for
    semantic vector search — activated when Qdrant client is connected).
    """

    def __init__(self, robot_id: str, db_path: str = "./memory/longterm.db"):
        self.robot_id = robot_id
        db_file = Path(db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(db_file), check_same_thread=False)
        self._init_schema()
        self._qdrant_client = None  # Inject Qdrant client for vector search

    def _init_schema(self):
        self._db.executescript("""
            CREATE TABLE IF NOT EXISTS memories (
                memory_id     TEXT PRIMARY KEY,
                memory_type   TEXT NOT NULL,
                importance    INTEGER NOT NULL,
                content       TEXT NOT NULL,
                summary       TEXT NOT NULL,
                tags          TEXT NOT NULL,
                robot_id      TEXT NOT NULL,
                created_at    REAL NOT NULL,
                last_accessed REAL NOT NULL,
                access_count  INTEGER DEFAULT 0,
                outcome       TEXT,
                skill_name    TEXT,
                confidence    REAL DEFAULT 1.0,
                success_rate  REAL DEFAULT 1.0
            );
            CREATE INDEX IF NOT EXISTS idx_robot_type ON memories(robot_id, memory_type);
            CREATE INDEX IF NOT EXISTS idx_tags ON memories(tags);
        """)
        self._db.commit()

    # ─── Store ────────────────────────────────────────────────────────────

    def store(self, record: MemoryRecord) -> str:
        """Persist a memory record to the long-term store."""
        self._db.execute(
            """INSERT OR REPLACE INTO memories VALUES (
                :memory_id, :memory_type, :importance, :content, :summary,
                :tags, :robot_id, :created_at, :last_accessed, :access_count,
                :outcome, :skill_name, :confidence, :success_rate
            )""",
            {
                "memory_id":     record.memory_id,
                "memory_type":   record.memory_type.value,
                "importance":    record.importance.value,
                "content":       json.dumps(record.content),
                "summary":       record.summary,
                "tags":          json.dumps(record.tags),
                "robot_id":      record.robot_id,
                "created_at":    record.created_at,
                "last_accessed": record.last_accessed,
                "access_count":  record.access_count,
                "outcome":       getattr(record, "outcome", None),
                "skill_name":    getattr(record, "skill_name", None),
                "confidence":    getattr(record, "confidence", 1.0),
                "success_rate":  getattr(record, "success_rate", 1.0),
            },
        )
        self._db.commit()
        return record.memory_id

    def store_episode(
        self,
        description: str,
        outcome: str,
        tags: list[str],
        content: dict,
        importance: MemoryImportance = MemoryImportance.MEDIUM,
        location: Optional[dict] = None,
    ) -> str:
        """Shorthand to store an episodic memory from a mission or event."""
        record = EpisodicMemory(
            memory_id=str(uuid.uuid4()),
            memory_type=MemoryType.EPISODIC,
            importance=importance,
            content=content,
            summary=description,
            tags=tags,
            robot_id=self.robot_id,
            outcome=outcome,
            location=location,
        )
        return self.store(record)

    def store_skill(
        self,
        skill_name: str,
        action_steps: list[dict],
        success_rate: float = 1.0,
        avg_duration_s: float = 0.0,
    ) -> str:
        """Store or update a learned procedural skill."""
        record = ProceduralMemory(
            memory_id=str(uuid.uuid4()),
            memory_type=MemoryType.PROCEDURAL,
            importance=MemoryImportance.HIGH,
            content={"steps": action_steps},
            summary=f"Skill: {skill_name}",
            tags=["skill", skill_name],
            robot_id=self.robot_id,
            skill_name=skill_name,
            action_steps=action_steps,
            success_rate=success_rate,
            avg_duration_s=avg_duration_s,
        )
        return self.store(record)

    # ─── Retrieve ─────────────────────────────────────────────────────────

    def recall(
        self,
        memory_type: Optional[MemoryType] = None,
        tags: Optional[list[str]] = None,
        limit: int = 20,
        min_importance: MemoryImportance = MemoryImportance.LOW,
    ) -> list[dict]:
        """
        Retrieve memories filtered by type, tags, and minimum importance.
        Returns results sorted by importance DESC, then recency DESC.
        """
        query = "SELECT * FROM memories WHERE robot_id = ?"
        params: list = [self.robot_id]

        if memory_type:
            query += " AND memory_type = ?"
            params.append(memory_type.value)

        query += " AND importance >= ?"
        params.append(min_importance.value)

        if tags:
            for tag in tags:
                query += " AND tags LIKE ?"
                params.append(f"%{tag}%")

        query += " ORDER BY importance DESC, last_accessed DESC LIMIT ?"
        params.append(limit)

        cursor = self._db.execute(query, params)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

        # Update access timestamps
        for row in rows:
            self._db.execute(
                "UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE memory_id = ?",
                (time.time(), row[0]),
            )
        self._db.commit()

        return [dict(zip(columns, row)) for row in rows]

    def get_skill(self, skill_name: str) -> Optional[dict]:
        """Retrieve a procedural skill by name."""
        results = self.recall(
            memory_type=MemoryType.PROCEDURAL,
            tags=["skill", skill_name],
            limit=1,
        )
        return results[0] if results else None

    def recall_critical(self) -> list[dict]:
        """Retrieve all CRITICAL importance memories (always included in context)."""
        return self.recall(min_importance=MemoryImportance.CRITICAL)

    def get_failure_history(self, limit: int = 10) -> list[dict]:
        """Retrieve recent failure episodes for self-improvement."""
        cursor = self._db.execute(
            "SELECT * FROM memories WHERE robot_id = ? AND memory_type = ? AND outcome = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (self.robot_id, MemoryType.EPISODIC.value, "failure", limit),
        )
        columns = [d[0] for d in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def stats(self) -> dict:
        """Memory system health statistics."""
        cursor = self._db.execute(
            "SELECT memory_type, COUNT(*) FROM memories WHERE robot_id = ? GROUP BY memory_type",
            (self.robot_id,),
        )
        counts = dict(cursor.fetchall())
        return {
            "robot_id": self.robot_id,
            "total_memories": sum(counts.values()),
            "by_type": counts,
        }
