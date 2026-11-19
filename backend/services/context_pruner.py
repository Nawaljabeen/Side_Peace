"""ContextPruner: trims chat history to the newest turns that fit the limits."""
from services.models import Turn


class ContextPruner:
    def __init__(self, max_turns: int, max_tokens: int, token_counter=None) -> None:
        self.max_turns = max_turns
        self.max_tokens = max_tokens
        self.token_counter = token_counter

    def prune(self, turns: list[Turn]) -> list[Turn]:
        return list(turns)
