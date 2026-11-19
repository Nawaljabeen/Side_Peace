"""SessionManager tests use fakes only: no sqlite3 and no real pruner (Dependency Inversion)."""
import pytest

from database.memory_adapter import InMemoryAdapter
from database.session_manager import SessionManager
from errors import StorageError
from services.models import Turn


class FakePruner:
    """Records what it was given and returns a canned answer."""

    def __init__(self, result: list[Turn]) -> None:
        self.result = result
        self.calls: list[list[Turn]] = []

    def prune(self, turns: list[Turn]) -> list[Turn]:
        self.calls.append(list(turns))
        return self.result


class FailingStorage(InMemoryAdapter):
    async def get_turns(self, session_id: str) -> list[Turn]:
        raise StorageError("storage is down")


def make_turn(index: int, text: str = "hello") -> Turn:
    return Turn(index=index, role="user" if index % 2 == 0 else "model", text=text)


async def test_add_turn_stores_the_turn_and_returns_the_count():
    storage = InMemoryAdapter()
    manager = SessionManager(storage, FakePruner([]))

    assert await manager.add_turn("s1", make_turn(0)) == 1
    assert await manager.add_turn("s1", make_turn(1)) == 2
    assert await storage.get_turns("s1") == [make_turn(0), make_turn(1)]


async def test_get_pruned_context_returns_what_the_pruner_returns():
    storage = InMemoryAdapter()
    for index in range(3):
        await storage.add_turn("s1", make_turn(index))
    pruner = FakePruner(result=[make_turn(2)])
    manager = SessionManager(storage, pruner)

    context = await manager.get_pruned_context("s1")

    assert context == [make_turn(2)]
    assert pruner.calls == [[make_turn(0), make_turn(1), make_turn(2)]]  # called once, with the stored turns


async def test_session_with_no_turns_gives_the_pruner_an_empty_history():
    pruner = FakePruner(result=[])
    manager = SessionManager(InMemoryAdapter(), pruner)

    assert await manager.get_pruned_context("never-synced") == []
    assert pruner.calls == [[]]


async def test_storage_errors_are_not_swallowed():
    manager = SessionManager(FailingStorage(), FakePruner([]))

    with pytest.raises(StorageError):
        await manager.get_pruned_context("s1")