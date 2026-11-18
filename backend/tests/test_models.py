import dataclasses

import pytest

from services.models import Turn


def test_turn_holds_index_role_and_text():
    turn = Turn(index=0, role="user", text="How do I reverse a list?")

    assert turn.index == 0
    assert turn.role == "user"
    assert turn.text == "How do I reverse a list?"


def test_turn_is_immutable():
    turn = Turn(index=0, role="user", text="hello")

    with pytest.raises(dataclasses.FrozenInstanceError):
        turn.text = "changed"


def test_turns_with_same_values_are_equal():
    assert Turn(0, "model", "hi") == Turn(0, "model", "hi")