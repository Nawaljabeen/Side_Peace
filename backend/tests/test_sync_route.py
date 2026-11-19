"""POST /sync (REQ-F02, REQ-F03, REQ-Q02). Black-box tests against docs/api-contract.md."""
import json
from pathlib import Path

import pytest

from database.memory_adapter import InMemoryAdapter
from errors import StorageError
from services.models import Turn
from tests.app_helpers import make_app, make_client

CONTRACT_DIR = Path(__file__).resolve().parents[2] / "docs" / "contract"


def sync_body(session_id="s1", index=0, role="user", text="hello"):
    return {"session_id": session_id, "turn": {"index": index, "role": role, "text": text}}


class FailingStorage(InMemoryAdapter):
    async def add_turn(self, session_id: str, turn: Turn) -> int:
        raise StorageError("disk full at C:\\secret\\sidepeace.db")


async def test_sync_stores_the_turn_and_reports_the_count():
    storage = InMemoryAdapter()
    async with make_client(make_app(storage=storage)) as client:
        response = await client.post("/sync", json=sync_body(text="How do I reverse a list?"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "turn_count": 1}
    assert await storage.get_turns("s1") == [Turn(0, "user", "How do I reverse a list?")]


async def test_each_new_index_grows_the_turn_count():
    async with make_client(make_app()) as client:
        first = await client.post("/sync", json=sync_body(index=0))
        second = await client.post("/sync", json=sync_body(index=1, role="model", text="answer"))

    assert first.json()["turn_count"] == 1
    assert second.json()["turn_count"] == 2


async def test_syncing_the_same_index_again_replaces_the_text():
    storage = InMemoryAdapter()
    async with make_client(make_app(storage=storage)) as client:
        await client.post("/sync", json=sync_body(index=0, text="partial"))
        response = await client.post("/sync", json=sync_body(index=0, text="final text"))

    assert response.json()["turn_count"] == 1
    assert await storage.get_turns("s1") == [Turn(0, "user", "final text")]


async def test_sessions_are_isolated_from_each_other():
    async with make_client(make_app()) as client:
        await client.post("/sync", json=sync_body(session_id="a"))
        await client.post("/sync", json=sync_body(session_id="a", index=1))
        response = await client.post("/sync", json=sync_body(session_id="b"))

    assert response.json()["turn_count"] == 1


async def test_the_contract_example_request_is_accepted_and_the_response_has_the_contract_keys():
    example = json.loads((CONTRACT_DIR / "sync-request.json").read_text(encoding="utf-8"))
    expected_keys = set(json.loads((CONTRACT_DIR / "sync-response.json").read_text(encoding="utf-8")))

    async with make_client(make_app()) as client:
        response = await client.post("/sync", json=example)

    assert response.status_code == 200
    assert set(response.json()) == expected_keys


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"session_id": "s1"},
        {"turn": {"index": 0, "role": "user", "text": "hi"}},
        sync_body(session_id=""),
        sync_body(session_id="bad id!"),
        sync_body(session_id="x" * 65),
        sync_body(index=-1),
        sync_body(role="system"),
        sync_body(text=""),
        sync_body(text="x" * 20001),
    ],
)
async def test_invalid_requests_get_a_contract_shaped_422_and_nothing_is_stored(body):
    storage = InMemoryAdapter()
    async with make_client(make_app(storage=storage)) as client:
        response = await client.post("/sync", json=body)

    assert response.status_code == 422
    assert set(response.json()) == {"error", "message"}
    assert response.json()["error"] == "validation_error"
    assert await storage.get_turns("s1") == []


async def test_a_body_that_is_not_json_gets_a_contract_shaped_422():
    async with make_client(make_app()) as client:
        response = await client.post("/sync", content="this is not json", headers={"content-type": "application/json"})

    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


async def test_a_storage_failure_returns_a_safe_500():
    async with make_client(make_app(storage=FailingStorage())) as client:
        response = await client.post("/sync", json=sync_body())

    assert response.status_code == 500
    assert response.json()["error"] == "storage_error"
    assert "secret" not in response.text
    assert "C:\\" not in response.text