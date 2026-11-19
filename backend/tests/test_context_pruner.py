"""Unit tests for ContextPruner (REQ-F03: prune chat history to fit limits)."""
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
