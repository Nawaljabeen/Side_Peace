"""Only Chrome extension pages may call the API from a browser (REQ-F02). No wildcard origins."""
import pytest

from tests.app_helpers import make_app, make_client

EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"


async def test_preflight_from_an_extension_is_allowed():
    async with make_client(make_app()) as client:
        response = await client.options(
            "/query",
            headers={
                "Origin": EXTENSION_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == EXTENSION_ORIGIN


async def test_a_real_request_from_an_extension_gets_the_allow_header():
    async with make_client(make_app()) as client:
        response = await client.get("/health", headers={"Origin": EXTENSION_ORIGIN})

    assert response.headers["access-control-allow-origin"] == EXTENSION_ORIGIN


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "https://gemini.google.com",
        "http://localhost:3000",
        "chrome-extension://tooshort",
        "chrome-extension://abcdefghijklmnopabcdefghijklmnop.evil.example",
        "null",
    ],
)
async def test_other_origins_get_no_allow_header(origin):
    async with make_client(make_app()) as client:
        response = await client.get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers


async def test_the_wildcard_is_never_used():
    async with make_client(make_app()) as client:
        response = await client.get("/health", headers={"Origin": EXTENSION_ORIGIN})

    assert response.headers["access-control-allow-origin"] != "*"