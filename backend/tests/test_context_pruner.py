"""Unit tests for ContextPruner (REQ-F03: prune chat history to fit limits)."""
import pytest

from services.context_pruner import ContextPruner
from services.models import Turn


def make_turns(count: int) -> list[Turn]:
    """Alternating user/model turns with indexes 0..count-1."""
    return [Turn(i, "user" if i % 2 == 0 else "model", f"turn {i}") for i in range(count)]


def test_empty_history_returns_empty_list():
    pruner = ContextPruner(max_turns=5, max_tokens=1000)
    assert pruner.prune([]) == []


def test_fewer_turns_than_limit_are_all_kept():
    turns = make_turns(3)
    pruner = ContextPruner(max_turns=5, max_tokens=1000)
    assert pruner.prune(turns) == turns


def test_more_turns_than_limit_keeps_newest_in_order():
    turns = make_turns(6)
    pruner = ContextPruner(max_turns=3, max_tokens=1000)
    assert pruner.prune(turns) == turns[3:]


@pytest.mark.parametrize("max_turns", [0, -1])
def test_non_positive_max_turns_raises_value_error(max_turns):
    with pytest.raises(ValueError):
        ContextPruner(max_turns=max_turns, max_tokens=1000)


@pytest.mark.parametrize("max_tokens", [0, -5])
def test_non_positive_max_tokens_raises_value_error(max_tokens):
    with pytest.raises(ValueError):
        ContextPruner(max_turns=5, max_tokens=max_tokens)
