from dataclasses import dataclass


@dataclass(frozen=True)
class Turn:

    index: int
    role: str
    text: str