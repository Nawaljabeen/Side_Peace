"""ContextPruner: trims chat history to the newest turns that fit the limits."""
from services.models import Turn


class ContextPruner:
    def __init__(self, max_turns: int, max_tokens: int, token_counter=None) -> None:
        if max_turns <= 0:
            raise ValueError("max_turns must be greater than 0")
        if max_tokens <= 0:
            raise ValueError("max_tokens must be greater than 0")
        self.max_turns = max_turns
        self.max_tokens = max_tokens
        self.token_counter = token_counter

    def prune(self, turns: list[Turn]) -> list[Turn]:
        pruned = turns[-self.max_turns:]
        while pruned and self._total_tokens(pruned) > self.max_tokens:
            pruned = pruned[1:]
        return pruned

    @staticmethod
    def _total_tokens(turns: list[Turn]) -> int:
        # rough estimate: about 4 characters per token
        return sum(-(-len(turn.text) // 4) for turn in turns)
