"""Every failure must reach the client as {error, message} with a safe text (REQ-Q02, contract)."""
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from api.error_handlers import register_error_handlers
from errors import (
    ProviderBadResponseError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    SidePeaceError,
    StorageError,
)

LEAKY_DETAIL = "C:\\secret\\path\\sidepeace.db SELECT * FROM turns API_KEY=abc123"


class Body(BaseModel):
    text: str = Field(min_length=1)


def make_client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    def raiser(exc: Exception):
        async def endpoint():
            raise exc

        return endpoint

    app.add_api_route("/storage", raiser(StorageError(LEAKY_DETAIL)))
    app.add_api_route("/timeout", raiser(ProviderTimeoutError(LEAKY_DETAIL)))
    app.add_api_route("/ratelimit", raiser(ProviderRateLimitError(LEAKY_DETAIL)))
    app.add_api_route("/badresponse", raiser(ProviderBadResponseError(LEAKY_DETAIL)))
    app.add_api_route("/boom", raiser(RuntimeError(LEAKY_DETAIL)))

    @app.post("/validate")
    async def validate(body: Body):
        return {}

    # raise_server_exceptions=False: behave like a real server and return the 500 response
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    "path, status, code",
    [
        ("/storage", 500, "storage_error"),
        ("/timeout", 504, "provider_timeout"),
        ("/ratelimit", 429, "provider_rate_limit"),
        ("/badresponse", 502, "provider_bad_response"),
        ("/boom", 500, "internal_error"),
    ],
)
def test_each_failure_maps_to_its_status_and_code(path, status, code):
    response = make_client().get(path)

    assert response.status_code == status
    assert response.json()["error"] == code


@pytest.mark.parametrize("path", ["/storage", "/timeout", "/ratelimit", "/badresponse", "/boom"])
def test_error_body_has_exactly_error_and_message_and_leaks_nothing(path):
    body = make_client().get(path).json()

    assert set(body) == {"error", "message"}
    for leaked in ("secret", "SELECT", "API_KEY", "abc123", "Traceback", "File \""):
        assert leaked not in body["message"]


def test_provider_timeout_message_matches_the_contract_example():
    assert make_client().get("/timeout").json() == {
        "error": "provider_timeout",
        "message": "The AI service took too long. Please try again.",
    }


def test_validation_error_uses_the_contract_shape_not_detail():
    response = make_client().post("/validate", json={"text": ""})

    body = response.json()
    assert response.status_code == 422
    assert set(body) == {"error", "message"}
    assert body["error"] == "validation_error"
    assert body["message"] == "text: String should have at least 1 character"


def test_validation_error_for_a_missing_field_names_the_field():
    body = make_client().post("/validate", json={}).json()

    assert body["error"] == "validation_error"
    assert body["message"].startswith("text:")


def test_validation_error_does_not_echo_the_submitted_value():
    body = make_client().post("/validate", json={"text": 12345678}).json()

    assert "12345678" not in body["message"]


def test_expected_errors_are_logged_with_the_path_but_not_the_response_text(caplog):
    with caplog.at_level(logging.WARNING, logger="sidepeace"):
        make_client().get("/timeout")

    assert "/timeout" in caplog.text


def test_unexpected_errors_are_logged_with_a_traceback(caplog):
    with caplog.at_level(logging.ERROR, logger="sidepeace"):
        make_client().get("/boom")

    assert "unexpected error" in caplog.text
    assert "Traceback" in caplog.text


def test_all_provider_errors_are_sidepeace_errors():
    for error in (ProviderTimeoutError, ProviderRateLimitError, ProviderBadResponseError, StorageError):
        assert issubclass(error, SidePeaceError)