"""Bad credentials, a wrong model and a bad model name are told apart in the log and at start-up (Fagan D-14, REQ-Q02, REQ-F02)."""
import logging

import httpx
import pytest

from errors import ConfigError, ProviderBadResponseError
from services.gemini_adapter import GeminiAdapter
from settings import load_settings

API_KEY = "SECRET-KEY-12345"


def make_adapter(handler) -> GeminiAdapter:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return GeminiAdapter(api_key=API_KEY, model="test-model", client=client)


@pytest.mark.parametrize("status", [401, 403])
async def test_rejected_credentials_are_logged_with_a_hint_about_the_key(status, caplog):
    adapter = make_adapter(lambda request: httpx.Response(status, json={"error": {"message": "no"}}))

    with caplog.at_level(logging.WARNING):
        with pytest.raises(ProviderBadResponseError):
            await adapter.generate_response("hi")

    assert "check GEMINI_API_KEY" in caplog.text
    assert API_KEY not in caplog.text


async def test_an_unknown_model_is_logged_with_a_hint_about_the_model(caplog):
    adapter = make_adapter(lambda request: httpx.Response(404, json={"error": {"message": "no"}}))

    with caplog.at_level(logging.WARNING):
        with pytest.raises(ProviderBadResponseError):
            await adapter.generate_response("hi")

    assert "check GEMINI_MODEL" in caplog.text


@pytest.mark.parametrize("model", ["gemini-3.5-flash-lite", "gemini-2.0-flash", "gemini_pro.1"])
def test_ordinary_model_names_are_accepted(model):
    assert load_settings({"GEMINI_API_KEY": API_KEY, "GEMINI_MODEL": model}).gemini_model == model


@pytest.mark.parametrize("model", ["models/gemini-2.0-flash", "gemini flash", "a/b", "gemini?key=x", "gemini:generate"])
def test_model_names_that_would_break_the_url_are_rejected_at_start_up(model):
    with pytest.raises(ConfigError):
        load_settings({"GEMINI_API_KEY": API_KEY, "GEMINI_MODEL": model})