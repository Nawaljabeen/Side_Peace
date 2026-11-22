"""Shared data model used by storage, the context pruner and the gateway."""
from dataclasses import dataclass

MAX_TURN_TEXT_LENGTH = 20000
MAX_TURN_INDEX = 2**63 - 1  # largest value SQLite can store in an INTEGER column
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
        if not isinstance(self.index, int) or isinstance(self.index, bool) or not 0 <= self.index <= MAX_TURN_INDEX:
            raise ValueError(f"index must be an integer from 0 to {MAX_TURN_INDEX}")
        if self.role not in VALID_ROLES:
            raise ValueError(f"role must be one of {VALID_ROLES}")
        if not isinstance(self.text, str) or not 1 <= len(self.text) <= MAX_TURN_TEXT_LENGTH:
            raise ValueError(f"text must be a string of 1-{MAX_TURN_TEXT_LENGTH} characters")