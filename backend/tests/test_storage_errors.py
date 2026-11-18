import logging

import pytest

from database.sqlite_adapter import SQLiteAdapter
from errors import SidePeaceError, StorageError
from services.models import Turn


@pytest.fixture(autouse=True)
def fresh_singleton():
    SQLiteAdapter.reset_instance()
    yield
    SQLiteAdapter.reset_instance()


def test_storage_error_is_a_sidepeace_error():
    assert issubclass(StorageError, SidePeaceError)


def test_unopenable_path_raises_storage_error(tmp_path):
    # A directory cannot be opened as a database file.
    with pytest.raises(StorageError):
        SQLiteAdapter.get_instance(str(tmp_path))


def test_failed_open_does_not_leave_a_broken_singleton(tmp_path):
    with pytest.raises(StorageError):
        SQLiteAdapter.get_instance(str(tmp_path))

    adapter = SQLiteAdapter.get_instance(str(tmp_path / "ok.db"))

    assert isinstance(adapter, SQLiteAdapter)


def test_get_instance_with_a_different_path_is_rejected(tmp_path):
    SQLiteAdapter.get_instance(str(tmp_path / "a.db"))

    with pytest.raises(StorageError):
        SQLiteAdapter.get_instance(str(tmp_path / "b.db"))


async def test_read_on_closed_database_raises_storage_error(tmp_path):
    adapter = SQLiteAdapter.get_instance(str(tmp_path / "a.db"))
    adapter.close()

    with pytest.raises(StorageError):
        await adapter.get_turns("s1")


async def test_write_on_closed_database_raises_storage_error(tmp_path):
    adapter = SQLiteAdapter.get_instance(str(tmp_path / "a.db"))
    adapter.close()

    with pytest.raises(StorageError):
        await adapter.add_turn("s1", Turn(0, "user", "hello"))


async def test_storage_failure_is_logged_without_leaking_to_the_message(tmp_path, caplog):
    adapter = SQLiteAdapter.get_instance(str(tmp_path / "secret-folder.db"))
    adapter.close()

    with caplog.at_level(logging.ERROR, logger="sidepeace"):
        with pytest.raises(StorageError) as excinfo:
            await adapter.get_turns("s1")

    assert "storage operation failed" in caplog.text
    assert "secret-folder" not in str(excinfo.value)