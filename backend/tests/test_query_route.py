"""POST /query (REQ-F02, REQ-F03, REQ-Q02). The route glues SessionManager, PromptFactory and the provider."""
import json
from pathlib import Path

import pytest

from database.memory_adapter import InMemoryAdapter
from errors import StorageError
from services.context_pruner import ContextPruner
from services.models import Turn
from tests.app_helpers import make_app, make_client
from tests.fakes import BadResponseProvider, CrashingProvider, FakeProvider, RateLimitProvider, TimeoutProvider

CONTRACT_DIR = Path(__file__).resolve().parents[2] / "docs" / "contract"


def query_body(session_id="s1", text="What does yield do?"):
    return {"session_id": session_id, "text": text}


async def seed(storage: InMemoryAdapter, session_id: str, *texts: str) -> None:
    for index, text in enumerate(texts):
        await storage.add_turn(session_id, Turn(index, "user" if index % 2 == 0 else "model", text))


class FailingReads(InMemoryAdapter):
    async def get_turns(self, session_id: str) -> list[Turn]:
        raise StorageError("cannot read C:\\secret\\sidepeace.db")


async def test_query_returns_the_providers_answer():
    async with make_client(make_app(provider=FakeProvider("It pauses a generator."))) as client:
        response = await client.post("/query", json=query_body())

    assert response.status_code == 200
    assert response.json() == {"answer": "It pauses a generator."}


async def test_the_prompt_contains_the_question_and_the_sessions_history():
    provider, storage = FakeProvider(), InMemoryAdapter()
    await seed(storage, "s1", "How do I reverse a linked list?", "Use three pointers.")
    async with make_client(make_app(provider=provider, storage=storage)) as client:
        await client.post("/query", json=query_body(text="What is a pointer?"))

    assert len(provider.prompts) == 1
    prompt = provider.prompts[0]
    assert "How do I reverse a linked list?" in prompt
    assert "Use three pointers." in prompt
    assert "What is a pointer?" in prompt


async def test_a_session_with_no_synced_turns_is_allowed():
    provider = FakeProvider("fine")
    async with make_client(make_app(provider=provider)) as client:
        response = await client.post("/query", json=query_body(session_id="brand-new"))

    assert response.status_code == 200
    assert "(no previous conversation)" in provider.prompts[0]


async def test_history_is_pruned_before_it_reaches_the_provider():
    provider, storage = FakeProvider(), InMemoryAdapter()
    await seed(storage, "s1", "oldest turn", "second turn", "third turn", "newest turn")
    pruner = ContextPruner(max_turns=2, max_tokens=1000)
    async with make_client(make_app(provider=provider, storage=storage, pruner=pruner)) as client:
        await client.post("/query", json=query_body())

    prompt = provider.prompts[0]
    assert "newest turn" in prompt and "third turn" in prompt
    assert "oldest turn" not in prompt and "second turn" not in prompt


async def test_one_sessions_history_never_reaches_another_sessions_prompt():
    provider, storage = FakeProvider(), InMemoryAdapter()
    await seed(storage, "a", "private text of session a")
    async with make_client(make_app(provider=provider, storage=storage)) as client:
        await client.post("/query", json=query_body(session_id="b"))

    assert "private text of session a" not in provider.prompts[0]


async def test_side_queries_are_not_stored_in_the_session_history():
    storage = InMemoryAdapter()
    await seed(storage, "s1", "main chat turn")
    async with make_client(make_app(storage=storage)) as client:
        await client.post("/query", json=query_body(text="a side question"))

    assert await storage.get_turns("s1") == [Turn(0, "user", "main chat turn")]


async def test_answers_are_not_cacheable():
    async with make_client(make_app()) as client:
        response = await client.post("/query", json=query_body())

    assert response.headers["cache-control"] == "no-store"


async def test_the_contract_example_request_is_accepted_and_the_response_has_the_contract_keys():
    example = json.loads((CONTRACT_DIR / "query-request.json").read_text(encoding="utf-8"))
    expected_keys = set(json.loads((CONTRACT_DIR / "query-response.json").read_text(encoding="utf-8")))

    async with make_client(make_app()) as client:
        response = await client.post("/query", json=example)

    assert response.status_code == 200
    assert set(response.json()) == expected_keys


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"session_id": "s1"},
        {"text": "hi"},
        query_body(session_id=""),
        query_body(session_id="bad id!"),
        query_body(text=""),
        query_body(text="   "),
        query_body(text="\n\t"),
        query_body(text="x" * 2001),
    ],
)
async def test_invalid_requests_get_a_422_and_the_provider_is_never_called(body):
    provider = FakeProvider()
    async with make_client(make_app(provider=provider)) as client:
        response = await client.post("/query", json=body)

    assert response.status_code == 422
    assert set(response.json()) == {"error", "message"}
    assert response.json()["error"] == "validation_error"
    assert provider.prompts == []


async def test_the_longest_allowed_question_is_accepted():
    async with make_client(make_app()) as client:
        response = await client.post("/query", json=query_body(text="x" * 2000))

    assert response.status_code == 200


@pytest.mark.parametrize(
    "provider, status, code",
    [
        (TimeoutProvider(), 504, "provider_timeout"),
        (RateLimitProvider(), 429, "provider_rate_limit"),
        (BadResponseProvider(), 502, "provider_bad_response"),
        (CrashingProvider(), 500, "internal_error"),
        (FakeProvider(""), 502, "provider_bad_response"),
        (FakeProvider("   \n"), 502, "provider_bad_response"),
    ],
)
async def test_provider_failures_map_to_the_contract_errors(provider, status, code):
    async with make_client(make_app(provider=provider)) as client:
        response = await client.post("/query", json=query_body())

    assert response.status_code == status
    assert set(response.json()) == {"error", "message"}
    assert response.json()["error"] == code
    assert "secret" not in response.text


async def test_the_timeout_response_matches_the_contract_example():
    example = json.loads((CONTRACT_DIR / "error-provider-timeout.json").read_text(encoding="utf-8"))

    async with make_client(make_app(provider=TimeoutProvider())) as client:
        response = await client.post("/query", json=query_body())

    assert response.json() == example


async def test_a_storage_failure_while_loading_history_returns_a_safe_500():
    provider = FakeProvider()
    async with make_client(make_app(provider=provider, storage=FailingReads())) as client:
        response = await client.post("/query", json=query_body())

    assert response.status_code == 500
    assert response.json()["error"] == "storage_error"
    assert "secret" not in response.text
    assert provider.prompts == []