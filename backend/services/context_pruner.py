"""ContextPruner: trims chat history to the newest turns that fit the limits."""
from collections.abc import Callable

from services.models import Turn

TokenCounter = Callable[[str], int]


def approximate_token_count(text: str) -> int:
    """Rough estimate: about 4 characters per token, rounded up."""
    return -(-len(text) // 4)


class ContextPruner:
    """Keeps the newest turns that satisfy both max_turns and max_tokens."""

    def __init__(
        self, max_turns: int, max_tokens: int, token_counter: TokenCounter | None = None
    ) -> None:
        if max_turns <= 0:
            raise ValueError("max_turns must be greater than 0")
        if max_tokens <= 0:
            raise ValueError("max_tokens must be greater than 0")
        self.max_turns = max_turns
        self.max_tokens = max_tokens
        self.token_counter = token_counter or approximate_token_count

    def prune(self, turns: list[Turn]) -> list[Turn]:
        pruned = turns[-self.max_turns:]
        while pruned and self._total_tokens(pruned) > self.max_tokens:
            pruned = pruned[1:]
        return pruned

    def _total_tokens(self, turns: list[Turn]) -> int:
        return sum(self.token_counter(turn.text) for turn in turns)
