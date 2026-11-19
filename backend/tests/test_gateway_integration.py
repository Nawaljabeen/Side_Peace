"""Whole-gateway tests: concurrent requests on the real SQLite adapter, and Gemini failures end to end.

These add no new behaviour; they check that the pieces built in earlier pairs work together
(REQ-Q05 / R-04 concurrency, REQ-Q02 safe failures, REQ-F02 no secrets in responses or logs).
"""
import asyncio
import json
import logging

import httpx
import pytest

from database.sqlite_adapter import SQLiteAdapter
from services.gemini_adapter import GeminiAdapter
from tests.app_helpers import make_app, make_client
from tests.fakes import FakeProvider

KEY = "SECRET-KEY-12345"
CONCURRENCY = 50


@pytest.fixture
def sqlite_storage(tmp_path):
    SQLiteAdapter.reset_instance()
    yield SQLiteAdapter.get_instance(str(tmp_path / "gateway.db"))
    SQLiteAdapter.reset_instance()


def sync_body(index: int, session_id: str = "s1", text: str | None = None) -> dict:
    return {"session_id": session_id, "turn": {"index": index, "role": "user", "text": text or f"turn {index}"}}


async def test_50_concurrent_syncs_all_succeed_and_lose_nothing(sqlite_storage):
    async with make_client(make_app(storage=sqlite_storage)) as client:
        responses = await asyncio.gather(*(client.post("/sync", json=sync_body(i)) for i in range(CONCURRENCY)))

    assert all(response.status_code == 200 for response in responses)
    assert sorted(response.json()["turn_count"] for response in responses) == list(range(1, CONCURRENCY + 1))
    turns = await sqlite_storage.get_turns("s1")
    assert [turn.index for turn in turns] == list(range(CONCURRENCY))


async def test_50_concurrent_syncs_of_the_same_index_leave_one_turn(sqlite_storage):
    async with make_client(make_app(storage=sqlite_storage)) as client:
        responses = await asyncio.gather(
            *(client.post("/sync", json=sync_body(0, text=f"version {i}")) for i in range(CONCURRENCY))
        )

    assert all(response.status_code == 200 for response in responses)
    assert len(await sqlite_storage.get_turns("s1")) == 1


async def test_50_concurrent_queries_all_get_an_answer(sqlite_storage):
    provider = FakeProvider("answer")
    async with make_client(make_app(provider=provider, storage=sqlite_storage)) as client:
        responses = await asyncio.gather(
            *(client.post("/query", json={"session_id": "s1", "text": f"question {i}"}) for i in range(CONCURRENCY))
        )

    assert all(response.status_code == 200 and response.json() == {"answer": "answer"} for response in responses)
    assert len(provider.prompts) == CONCURRENCY


async def test_syncs_and_queries_at_the_same_time_do_not_interfere(sqlite_storage):
    provider = FakeProvider("answer")
    async with make_client(make_app(provider=provider, storage=sqlite_storage)) as client:
        syncs = [client.post("/sync", json=sync_body(i)) for i in range(25)]
        queries = [client.post("/query", json={"session_id": "s1", "text": f"q{i}"}) for i in range(25)]
        responses = await asyncio.gather(*syncs, *queries)

    assert all(response.status_code == 200 for response in responses)
    assert len(await sqlite_storage.get_turns("s1")) == 25


def gemini_app(handler):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiAdapter(api_key=KEY, model="test-model", client=client)
    return make_app(provider=provider)


async def test_end_to_end_the_gemini_request_carries_the_history_and_the_question():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["prompt"] = json.loads(request.content)["contents"][0]["parts"][0]["text"]
        seen["key_header"] = request.headers["x-goog-api-key"]
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "A pointer is an address."}]}}]})

    async with make_client(gemini_app(handler)) as client:
        await client.post("/sync", json=sync_body(0, text="How do I reverse a linked list?"))
        response = await client.post("/query", json={"session_id": "s1", "text": "What is a pointer?"})

    assert response.json() == {"answer": "A pointer is an address."}
    assert "How do I reverse a linked list?" in seen["prompt"]
    assert "What is a pointer?" in seen["prompt"]
    assert seen["key_header"] == KEY


@pytest.mark.parametrize(
    "gemini_response, status, code",
    [
        (httpx.Response(429, json={"error": {"message": f"quota exceeded for {KEY}"}}), 429, "provider_rate_limit"),
        (httpx.Response(500, json={"error": {"message": f"upstream secret detail {KEY}"}}), 502, "provider_bad_response"),
        (httpx.Response(200, json={"candidates": []}), 502, "provider_bad_response"),
    ],
)
async def test_gemini_failures_reach_the_client_safely_and_the_key_never_leaks(gemini_response, status, code, caplog):
    with caplog.at_level(logging.DEBUG):
        async with make_client(gemini_app(lambda request: gemini_response)) as client:
            response = await client.post("/query", json={"session_id": "s1", "text": "hi"})

    assert response.status_code == status
    assert response.json()["error"] == code
    assert KEY not in response.text
    assert "upstream secret detail" not in response.text
    assert KEY not in caplog.text


async def test_a_gemini_timeout_reaches_the_client_as_a_504(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout(f"too slow {KEY}", request=request)

    with caplog.at_level(logging.DEBUG):
        async with make_client(gemini_app(handler)) as client:
            response = await client.post("/query", json={"session_id": "s1", "text": "hi"})

    assert response.status_code == 504
    assert response.json()["error"] == "provider_timeout"
    assert KEY not in response.text and KEY not in caplog.text