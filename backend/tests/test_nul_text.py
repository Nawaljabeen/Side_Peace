"""Turn text with a NUL character is rejected at the boundary, so both adapters agree (Fagan D-04, REQ-F05)."""
import pytest
from pydantic import ValidationError

from api.schemas import TurnIn
from services.models import Turn
from tests.app_helpers import make_app, make_client

NUL_TEXTS = ["\x00", "\x00abc", "abc\x00", "ab\x00cd"]


@pytest.mark.parametrize("text", NUL_TEXTS)
def test_schema_rejects_text_with_a_nul_character(text):
    with pytest.raises(ValidationError):
        TurnIn(index=0, role="user", text=text)


@pytest.mark.parametrize("text", NUL_TEXTS)
def test_domain_object_rejects_text_with_a_nul_character(text):
    with pytest.raises(ValueError):
        Turn(0, "user", text)


async def test_sync_with_a_nul_character_gets_a_422_not_a_500():
    body = {"session_id": "s1", "turn": {"index": 0, "role": "user", "text": "\x00abc"}}
    async with make_client(make_app()) as client:
        response = await client.post("/sync", json=body)

    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"