"""Concurrency tests for the storage layer (REQ-Q05, QR-05, risk R-04)."""
import asyncio

import pytest

from database.sqlite_adapter import SQLiteAdapter
from services.models import Turn


@pytest.fixture
def adapter(tmp_path):
    SQLiteAdapter.reset_instance()
    yield SQLiteAdapter.get_instance(str(tmp_path / "concurrency.db"))
    SQLiteAdapter.reset_instance()


async def test_50_concurrent_writes_lose_nothing(adapter):
    await asyncio.gather(*(adapter.add_turn("s1", Turn(i, "user", f"msg{i}")) for i in range(50)))

    assert [t.index for t in await adapter.get_turns("s1")] == list(range(50))


async def test_concurrent_writes_report_distinct_turn_counts(adapter):
    counts = await asyncio.gather(*(adapter.add_turn("s1", Turn(i, "user", f"msg{i}")) for i in range(50)))

    assert sorted(counts) == list(range(1, 51))


async def test_two_interleaved_sessions_do_not_mix(adapter):
    writes = []
    for i in range(25):
        writes.append(adapter.add_turn("s1", Turn(i, "user", f"a{i}")))
        writes.append(adapter.add_turn("s2", Turn(i, "model", f"b{i}")))

    await asyncio.gather(*writes)

    assert [t.text for t in await adapter.get_turns("s1")] == [f"a{i}" for i in range(25)]
    assert [t.text for t in await adapter.get_turns("s2")] == [f"b{i}" for i in range(25)]


async def test_concurrent_writes_to_one_index_keep_the_last_submitted(adapter):
    await asyncio.gather(*(adapter.add_turn("s1", Turn(0, "user", f"v{i}")) for i in range(50)))

    assert await adapter.get_turns("s1") == [Turn(0, "user", "v49")]



async def test_100_concurrent_reads_all_succeed(adapter):
    for i in range(5):
        await adapter.add_turn("s1", Turn(i, "user", f"msg{i}"))

    results = await asyncio.gather(*(adapter.get_turns("s1") for _ in range(100)))

    assert all([t.index for t in turns] == list(range(5)) for turns in results)


async def test_reads_during_writes_never_fail_and_see_a_consistent_prefix(adapter):
    writes = [adapter.add_turn("s1", Turn(i, "user", f"msg{i}")) for i in range(50)]
    reads = [adapter.get_turns("s1") for _ in range(50)]

    results = await asyncio.gather(*writes, *reads)

    for turns in results[50:]:
        assert [t.index for t in turns] == list(range(len(turns)))
    assert len(await adapter.get_turns("s1")) == 50