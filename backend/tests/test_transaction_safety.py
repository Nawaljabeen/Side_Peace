"""A failed write must always end its transaction, whatever the error (Fagan D-01 and D-16, REQ-Q07)."""
import sqlite3

import pytest

import database.sqlite_adapter as sqlite_adapter
from database.sqlite_adapter import SQLiteAdapter
from errors import StorageError
from services.models import Turn


@pytest.fixture
def adapter(tmp_path):
    SQLiteAdapter.reset_instance()
    yield SQLiteAdapter.get_instance(str(tmp_path / "tx.db"))
    SQLiteAdapter.reset_instance()


class FlakyConnection:
    """Wraps the real connection; the first INSERT into turns raises, and ROLLBACK can be made to fail too."""

    def __init__(self, real, insert_error, rollback_error=None):
        self._real = real
        self._insert_error = insert_error
        self._rollback_error = rollback_error
        self._failed = False

    def execute(self, sql, *args):
        if "INSERT INTO turns" in sql and not self._failed:
            self._failed = True
            raise self._insert_error
        if sql == "ROLLBACK" and self._rollback_error is not None:
            self._real.execute("ROLLBACK")
            raise self._rollback_error
        return self._real.execute(sql, *args)

    def close(self):
        self._real.close()


async def test_a_non_sqlite_error_still_ends_the_transaction(adapter):
    adapter._conn = FlakyConnection(adapter._conn, RuntimeError("boom"))

    with pytest.raises(RuntimeError):
        await adapter.add_turn("s1", Turn(0, "user", "first"))

    assert await adapter.add_turn("s1", Turn(0, "user", "second")) == 1


async def test_a_sqlite_error_ends_the_transaction_and_becomes_a_storage_error(adapter):
    adapter._conn = FlakyConnection(adapter._conn, sqlite3.OperationalError("disk I/O error"))

    with pytest.raises(StorageError):
        await adapter.add_turn("s1", Turn(0, "user", "first"))

    assert await adapter.add_turn("s1", Turn(0, "user", "second")) == 1


async def test_a_failing_rollback_does_not_hide_the_original_error(adapter):
    adapter._conn = FlakyConnection(
        adapter._conn, sqlite3.OperationalError("original"), rollback_error=sqlite3.OperationalError("rollback failed")
    )

    with pytest.raises(StorageError) as excinfo:
        await adapter.add_turn("s1", Turn(0, "user", "first"))

    assert str(excinfo.value.__cause__) == "original"


def test_a_schema_that_cannot_be_applied_raises_a_storage_error(tmp_path, monkeypatch):
    broken = tmp_path / "broken.sql"
    broken.write_text("THIS IS NOT SQL;", encoding="utf-8")
    monkeypatch.setattr(sqlite_adapter, "SCHEMA_PATH", broken)
    SQLiteAdapter.reset_instance()

    with pytest.raises(StorageError):
        SQLiteAdapter.get_instance(str(tmp_path / "x.db"))

    assert SQLiteAdapter._instance is None