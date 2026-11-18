import sqlite3
from contextlib import closing

import pytest

from database.sqlite_adapter import SQLiteAdapter
from services.models import Turn


@pytest.fixture(autouse=True)
def fresh_singleton():
    SQLiteAdapter.reset_instance()
    yield
    SQLiteAdapter.reset_instance()


def test_get_instance_returns_the_same_object(tmp_path):
    db = str(tmp_path / "a.db")

    assert SQLiteAdapter.get_instance(db) is SQLiteAdapter.get_instance(db)


def test_get_instance_without_path_reuses_the_existing_instance(tmp_path):
    first = SQLiteAdapter.get_instance(str(tmp_path / "a.db"))

    assert SQLiteAdapter.get_instance() is first


def test_reset_instance_gives_a_fresh_object(tmp_path):
    db = str(tmp_path / "a.db")
    first = SQLiteAdapter.get_instance(db)

    SQLiteAdapter.reset_instance()

    assert SQLiteAdapter.get_instance(db) is not first


async def test_data_survives_closing_and_reopening_the_same_file(tmp_path):
    db = str(tmp_path / "a.db")
    await SQLiteAdapter.get_instance(db).add_turn("s1", Turn(0, "user", "kept"))

    SQLiteAdapter.reset_instance()

    assert await SQLiteAdapter.get_instance(db).get_turns("s1") == [Turn(0, "user", "kept")]


def test_database_file_uses_wal_mode(tmp_path):
    db = str(tmp_path / "a.db")
    SQLiteAdapter.get_instance(db)

    with closing(sqlite3.connect(db)) as other:
        assert other.execute("PRAGMA journal_mode").fetchone()[0] == "wal"