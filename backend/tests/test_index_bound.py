"""A turn index must fit SQLite's 64-bit integer, or the API answers 422 (Fagan D-02, REQ-F05)."""
import pytest
from pydantic import ValidationError

from api.schemas import TurnIn
from services.models import Turn
from tests.app_helpers import make_app, make_client

MAX_TURN_INDEX = 2**63 - 1  # largest value SQLite can store in an INTEGER column
OVER = MAX_TURN_INDEX + 1


def test_the_largest_sqlite_integer_is_accepted():
    assert TurnIn(index=MAX_TURN_INDEX, role="user", text="hi").index == MAX_TURN_INDEX
    assert Turn(MAX_TURN_INDEX, "user", "hi").index == MAX_TURN_INDEX


def test_one_above_the_limit_is_rejected_by_the_schema():
    with pytest.raises(ValidationError):
        TurnIn(index=OVER, role="user", text="hi")


def test_one_above_the_limit_is_rejected_by_the_domain_object():
    with pytest.raises(ValueError):
        Turn(OVER, "user", "hi")


async def test_sync_with_an_out_of_range_index_gets_a_422_not_a_500():
    body = {"session_id": "s1", "turn": {"index": OVER, "role": "user", "text": "hi"}}
    async with make_client(make_app()) as client:
        response = await client.post("/sync", json=body)

    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"