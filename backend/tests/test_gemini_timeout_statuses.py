"""504 and 408 from Google are timeouts, as the API contract says (Fagan D-03, REQ-Q02)."""
import httpx
import pytest

from errors import ProviderTimeoutError
from services.gemini_adapter import GeminiAdapter


def make_adapter(handler) -> GeminiAdapter:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return GeminiAdapter(api_key="SECRET-KEY-12345", model="test-model", client=client)


@pytest.mark.parametrize("status", [408, 504])
async def test_a_provider_timeout_status_becomes_provider_timeout_error(status):
    adapter = make_adapter(lambda request: httpx.Response(status, json={"error": {"message": "slow"}}))

    with pytest.raises(ProviderTimeoutError):
        await adapter.generate_response("hi")