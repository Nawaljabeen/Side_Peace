"""Shared data model used by storage, the context pruner and the gateway."""
from dataclasses import dataclass

MAX_TURN_TEXT_LENGTH = 20000
VALID_ROLES = ("user", "model")


@dataclass(frozen=True)
class Turn:
    """One finished chat turn. Immutable so it is safe to share between coroutines.

    Raises ValueError when a field breaks the rules in docs/api-contract.md.
    """

    index: int
    role: str
    text: str

    def __post_init__(self) -> None:
        # bool is a subclass of int, so True would otherwise slip through as index 1.
        if not isinstance(self.index, int) or isinstance(self.index, bool) or self.index < 0:
            raise ValueError("index must be an integer >= 0")
        if self.role not in VALID_ROLES:
            raise ValueError(f"role must be one of {VALID_ROLES}")
        if not isinstance(self.text, str) or not 1 <= len(self.text) <= MAX_TURN_TEXT_LENGTH:
            raise ValueError(f"text must be a string of 1-{MAX_TURN_TEXT_LENGTH} characters")