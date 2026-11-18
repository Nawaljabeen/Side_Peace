"""In-memory storage adapter: the fake used by tests and by contract tests."""
from database.base import AbstractStorageAdapter
from services.models import Turn


class InMemoryAdapter(AbstractStorageAdapter):
    """Keeps turns in a dict per session. No awaits inside, so event-loop writes cannot interleave."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[int, Turn]] = {}

    async def get_turns(self, session_id: str) -> list[Turn]:
        turns = self._sessions.get(session_id, {})
        return [turns[index] for index in sorted(turns)]

    async def add_turn(self, session_id: str, turn: Turn) -> int:
        session = self._sessions.setdefault(session_id, {})
        session[turn.index] = turn
        return len(session)