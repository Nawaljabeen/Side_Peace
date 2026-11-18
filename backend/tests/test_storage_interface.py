import inspect

import pytest

from database.base import AbstractStorageAdapter, MessageReader, MessageWriter
from services.models import Turn


def test_reader_and_writer_cannot_be_instantiated():
    with pytest.raises(TypeError):
        MessageReader()
    with pytest.raises(TypeError):
        MessageWriter()


def test_reader_only_declares_read_methods():
    assert hasattr(MessageReader, "get_turns")
    assert not hasattr(MessageReader, "add_turn")


def test_writer_only_declares_write_methods():
    assert hasattr(MessageWriter, "add_turn")
    assert not hasattr(MessageWriter, "get_turns")


def test_read_only_class_can_implement_reader_alone():
    class ReadOnly(MessageReader):
        async def get_turns(self, session_id: str) -> list[Turn]:
            return []

    assert isinstance(ReadOnly(), MessageReader)
    assert not isinstance(ReadOnly(), MessageWriter)


def test_interface_methods_are_async():
    assert inspect.iscoroutinefunction(MessageReader.get_turns)
    assert inspect.iscoroutinefunction(MessageWriter.add_turn)


def test_adapter_combines_reader_and_writer_and_needs_both():
    assert issubclass(AbstractStorageAdapter, MessageReader)
    assert issubclass(AbstractStorageAdapter, MessageWriter)

    class HalfDone(AbstractStorageAdapter):
        async def get_turns(self, session_id: str) -> list[Turn]:
            return []

    with pytest.raises(TypeError):
        HalfDone()