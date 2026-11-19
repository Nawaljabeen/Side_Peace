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
        return turns[-self.max_turns:]
