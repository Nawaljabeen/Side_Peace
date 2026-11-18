"""Contract tests every storage adapter must pass.

PR 2 adds SQLiteAdapter to the fixture params below; the tests stay unchanged.
"""
import pytest

from database.base import AbstractStorageAdapter
from database.memory_adapter import InMemoryAdapter
from services.models import Turn


@pytest.fixture(params=["memory"])
def adapter(request) -> AbstractStorageAdapter:
    if request.param == "memory":
        return InMemoryAdapter()
    raise ValueError(request.param)


def make_turn(index: int, text: str = "hello", role: str = "user") -> Turn:
    return Turn(index=index, role=role, text=text)


def test_adapter_implements_the_storage_interface(adapter):
    assert isinstance(adapter, AbstractStorageAdapter)


async def test_unknown_session_returns_empty_list(adapter):
    assert await adapter.get_turns("no-such-session") == []


async def test_added_turn_can_be_read_back(adapter):
    await adapter.add_turn("s1", make_turn(0, "first"))

    assert await adapter.get_turns("s1") == [make_turn(0, "first")]


async def test_add_turn_returns_the_session_turn_count(adapter):
    assert await adapter.add_turn("s1", make_turn(0)) == 1
    assert await adapter.add_turn("s1", make_turn(1, role="model")) == 2


async def test_turns_come_back_ordered_by_index(adapter):
    for index in (2, 0, 1):
        await adapter.add_turn("s1", make_turn(index, f"msg{index}"))

    assert [t.index for t in await adapter.get_turns("s1")] == [0, 1, 2]


async def test_same_index_replaces_the_old_turn(adapter):
    await adapter.add_turn("s1", make_turn(0, "old"))

    count = await adapter.add_turn("s1", make_turn(0, "new"))

    assert count == 1
    assert await adapter.get_turns("s1") == [make_turn(0, "new")]


async def test_sessions_are_isolated(adapter):
    await adapter.add_turn("s1", make_turn(0, "for s1"))
    await adapter.add_turn("s2", make_turn(0, "for s2"))

    assert [t.text for t in await adapter.get_turns("s1")] == ["for s1"]
    assert [t.text for t in await adapter.get_turns("s2")] == ["for s2"]


async def test_returned_list_is_a_copy(adapter):
    await adapter.add_turn("s1", make_turn(0))

    (await adapter.get_turns("s1")).clear()

    assert len(await adapter.get_turns("s1")) == 1