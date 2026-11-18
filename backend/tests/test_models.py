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



@pytest.mark.parametrize("index", [-1, 1.5, "0", None, True])
def test_turn_rejects_invalid_index(index):
    with pytest.raises(ValueError):
        Turn(index=index, role="user", text="hello")


@pytest.mark.parametrize("index", [0, 1, 1000])
def test_turn_accepts_valid_index(index):
    assert Turn(index=index, role="user", text="hello").index == index


@pytest.mark.parametrize("role", ["system", "User", "", None])
def test_turn_rejects_invalid_role(role):
    with pytest.raises(ValueError):
        Turn(index=0, role=role, text="hello")


@pytest.mark.parametrize("role", ["user", "model"])
def test_turn_accepts_valid_role(role):
    assert Turn(index=0, role=role, text="hello").role == role


@pytest.mark.parametrize("text", ["", "x" * 20001, None, 123])
def test_turn_rejects_invalid_text(text):
    with pytest.raises(ValueError):
        Turn(index=0, role="user", text=text)


@pytest.mark.parametrize("length", [1, 2, 19999, 20000])
def test_turn_accepts_text_at_length_boundaries(length):
    assert len(Turn(index=0, role="user", text="x" * length).text) == length