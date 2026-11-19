"""GeminiAdapter tests: no real network, requests are answered by httpx.MockTransport."""
import json
import logging

import httpx
import pytest

from errors import ProviderBadResponseError, ProviderRateLimitError, ProviderTimeoutError
from services.gemini_adapter import GeminiAdapter
from services.llm_provider import AbstractLLMProvider

API_KEY = "SECRET-KEY-12345"
MODEL = "test-model"


def make_adapter(handler) -> GeminiAdapter:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return GeminiAdapter(api_key=API_KEY, model=MODEL, client=client)


def answer_body(*texts: str) -> dict:
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": t} for t in texts]}}]}


def test_adapter_is_an_llm_provider():
    assert isinstance(make_adapter(lambda request: httpx.Response(200)), AbstractLLMProvider)


def test_empty_api_key_is_rejected():
    with pytest.raises(ValueError):
        GeminiAdapter(api_key="", model=MODEL)


async def test_request_follows_the_gemini_rest_format():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["url"] = str(request.url)
        seen["key_header"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=answer_body("ok"))

    await make_adapter(handler).generate_response("What is a mutex?")

    assert seen["method"] == "POST"
    assert seen["url"] == "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent"
    assert seen["key_header"] == API_KEY
    assert seen["body"] == {"contents": [{"role": "user", "parts": [{"text": "What is a mutex?"}]}]}


async def test_api_key_is_only_in_the_header_not_in_url_or_body():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["content"] = request.content.decode()
        return httpx.Response(200, json=answer_body("ok"))

    await make_adapter(handler).generate_response("hi")

    assert API_KEY not in seen["url"]
    assert API_KEY not in seen["content"]


async def test_answer_text_is_extracted_and_parts_are_joined():
    adapter = make_adapter(lambda request: httpx.Response(200, json=answer_body("Hello ", "world")))

    assert await adapter.generate_response("hi") == "Hello world"


async def test_rate_limit_status_becomes_provider_rate_limit_error():
    adapter = make_adapter(lambda request: httpx.Response(429, json={"error": {"message": "quota"}}))

    with pytest.raises(ProviderRateLimitError):
        await adapter.generate_response("hi")


@pytest.mark.parametrize("status", [400, 401, 403, 404, 500, 503])
async def test_other_error_statuses_become_provider_bad_response_error(status):
    adapter = make_adapter(lambda request: httpx.Response(status, json={"error": {"message": "nope"}}))

    with pytest.raises(ProviderBadResponseError):
        await adapter.generate_response("hi")


async def test_timeout_becomes_provider_timeout_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    with pytest.raises(ProviderTimeoutError):
        await make_adapter(handler).generate_response("hi")


async def test_network_failure_becomes_provider_bad_response_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(ProviderBadResponseError):
        await make_adapter(handler).generate_response("hi")


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"not json at all"),
        httpx.Response(200, json={}),
        httpx.Response(200, json={"candidates": []}),
        httpx.Response(200, json={"candidates": [{"finishReason": "SAFETY"}]}),
        httpx.Response(200, json={"candidates": [{"content": {"parts": []}}]}),
        httpx.Response(200, json=answer_body("")),
        httpx.Response(200, json=answer_body("   ")),
        httpx.Response(200, json=["unexpected", "list"]),
    ],
)
async def test_unusable_success_responses_become_provider_bad_response_error(response):
    adapter = make_adapter(lambda request: response)

    with pytest.raises(ProviderBadResponseError):
        await adapter.generate_response("hi")


async def test_api_key_never_appears_in_errors_or_logs(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot reach host with {API_KEY}", request=request)

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(ProviderBadResponseError) as excinfo:
            await make_adapter(handler).generate_response("hi")

    assert API_KEY not in str(excinfo.value)
    assert API_KEY not in caplog.text