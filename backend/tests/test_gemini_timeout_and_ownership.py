"""The timeout is a total deadline that also applies to an injected client, and aclose() closes only what the
adapter created (Fagan D-15, REQ-Q02)."""
import asyncio

import httpx
import pytest

from errors import ProviderTimeoutError
from services.gemini_adapter import GeminiAdapter


async def test_a_slow_answer_hits_the_total_deadline_even_with_an_injected_client():
    async def slow(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(0.5)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "late"}]}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(slow))
    adapter = GeminiAdapter(api_key="k", model="m", client=client, timeout_seconds=0.05)

    with pytest.raises(ProviderTimeoutError):
        await adapter.generate_response("hi")


async def test_aclose_leaves_an_injected_client_open():
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200)))
    adapter = GeminiAdapter(api_key="k", model="m", client=client)

    await adapter.aclose()

    assert client.is_closed is False
    await client.aclose()


async def test_aclose_closes_the_client_the_adapter_created():
    adapter = GeminiAdapter(api_key="k", model="m")

    await adapter.aclose()

    assert adapter._client.is_closed is True