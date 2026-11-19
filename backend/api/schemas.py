"""Request and response models: the API contract in code (docs/api-contract.md).

Strict mode: "0" is not an integer index, 123 is not a text. Limits come from one constant each.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from services.models import MAX_TURN_TEXT_LENGTH
from services.prompt_factory import MAX_QUESTION_LENGTH

SESSION_ID_PATTERN = r"^[A-Za-z0-9_-]+$"
MAX_SESSION_ID_LENGTH = 64


class _Strict(BaseModel):
    model_config = ConfigDict(strict=True)


class TurnIn(_Strict):
    index: int = Field(ge=0)
    role: Literal["user", "model"]
    text: str = Field(min_length=1, max_length=MAX_TURN_TEXT_LENGTH)


class SyncRequest(_Strict):
    session_id: str = Field(min_length=1, max_length=MAX_SESSION_ID_LENGTH, pattern=SESSION_ID_PATTERN)
    turn: TurnIn


class SyncResponse(BaseModel):
    status: Literal["ok"] = "ok"
    turn_count: int


class QueryRequest(_Strict):
    session_id: str = Field(min_length=1, max_length=MAX_SESSION_ID_LENGTH, pattern=SESSION_ID_PATTERN)
    text: str = Field(min_length=1, max_length=MAX_QUESTION_LENGTH)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value


class QueryResponse(BaseModel):
    answer: str