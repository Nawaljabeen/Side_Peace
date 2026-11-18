"""SQLite storage adapter (Singleton).

One adapter object owns the one connection to the database file. Parameterised SQL only.
I/O runs in a worker thread (asyncio.to_thread) so the event loop is never blocked.
Writes from concurrent callers must be serialised by the WriteQueue (see docs/thread-safety.md).
"""
import asyncio
import sqlite3
from pathlib import Path

from database.base import AbstractStorageAdapter
from services.models import Turn

DEFAULT_DB_PATH = "sidepeace.db"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class SQLiteAdapter(AbstractStorageAdapter):
    _instance: "SQLiteAdapter | None" = None

    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        # isolation_level=None: we issue BEGIN/COMMIT ourselves. check_same_thread=False:
        # the connection is used from asyncio.to_thread workers (one at a time, via the queue).
        self._conn = sqlite3.connect(db_path, check_same_thread=False, isolation_level=None, timeout=5.0)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    @classmethod
    def get_instance(cls, db_path: str | None = None) -> "SQLiteAdapter":
        if cls._instance is None:
            cls._instance = cls(db_path or DEFAULT_DB_PATH)
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Close and forget the instance. Used by tests and at application shutdown."""
        if cls._instance is not None:
            cls._instance.close()
            cls._instance = None

    def close(self) -> None:
        self._conn.close()

    async def get_turns(self, session_id: str) -> list[Turn]:
        return await asyncio.to_thread(self._get_turns_sync, session_id)

    async def add_turn(self, session_id: str, turn: Turn) -> int:
        return await asyncio.to_thread(self._add_turn_sync, session_id, turn)

    def _get_turns_sync(self, session_id: str) -> list[Turn]:
        rows = self._conn.execute(
            "SELECT idx, role, text FROM turns WHERE session_id = ? ORDER BY idx", (session_id,)
        ).fetchall()
        return [Turn(index=idx, role=role, text=text) for idx, role, text in rows]

    def _add_turn_sync(self, session_id: str, turn: Turn) -> int:
        self._conn.execute("BEGIN IMMEDIATE")
        try:
            self._conn.execute("INSERT OR IGNORE INTO sessions(session_id) VALUES (?)", (session_id,))
            self._conn.execute(
                "INSERT INTO turns(session_id, idx, role, text) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(session_id, idx) DO UPDATE SET role = excluded.role, text = excluded.text",
                (session_id, turn.index, turn.role, turn.text),
            )
            (count,) = self._conn.execute(
                "SELECT COUNT(*) FROM turns WHERE session_id = ?", (session_id,)
            ).fetchone()
            self._conn.execute("COMMIT")
        except sqlite3.Error:
            self._conn.execute("ROLLBACK")
            raise
        return count