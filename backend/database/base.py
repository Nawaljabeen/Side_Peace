"""Storage interfaces.

Read paths depend only on MessageReader; write paths only on MessageWriter.
AbstractStorageAdapter is for classes that do both (SQLiteAdapter, InMemoryAdapter).
"""
from abc import ABC, abstractmethod

from services.models import Turn


class MessageReader(ABC):
    @abstractmethod
    async def get_turns(self, session_id: str) -> list[Turn]:
        """Return the session's turns ordered by index; [] for an unknown session."""


class MessageWriter(ABC):
    @abstractmethod
    async def add_turn(self, session_id: str, turn: Turn) -> int:
        """Store the turn (same index replaces the old one); return the session's turn count."""


class AbstractStorageAdapter(MessageReader, MessageWriter):
    """A storage backend that can both read and write turns."""