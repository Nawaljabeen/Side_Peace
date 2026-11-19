"""SessionManager: application-level API over storage and context pruning.

Both collaborators are injected (Dependency Inversion): it knows the AbstractStorageAdapter
interface and anything with a prune() method, never sqlite3 or a concrete pruner.
"""
from typing import Protocol

from database.base import AbstractStorageAdapter
from services.models import Turn


class Pruner(Protocol):
    def prune(self, turns: list[Turn]) -> list[Turn]: ...


class SessionManager:
    def __init__(self, storage: AbstractStorageAdapter, pruner: Pruner) -> None:
        self._storage = storage
        self._pruner = pruner

    async def add_turn(self, session_id: str, turn: Turn) -> int:
        """Store a synced turn; returns how many turns the session now holds."""
        return await self._storage.add_turn(session_id, turn)

    async def get_pruned_context(self, session_id: str) -> list[Turn]:
        """The session's history trimmed to fit the limits. Empty for an unknown session."""
        turns = await self._storage.get_turns(session_id)
        return self._pruner.prune(turns)