"""Unknown paths and wrong methods must also use the contract error shape, not FastAPI's {"detail": ...}."""
import pytest

from tests.app_helpers import make_app, make_client


@pytest.mark.parametrize(
    "method, path, status, code",
    [
        ("GET", "/nope", 404, "not_found"),
        ("GET", "/sync", 405, "method_not_allowed"),
        ("POST", "/health", 405, "method_not_allowed"),
    ],
)
async def test_routing_failures_use_the_contract_error_shape(method, path, status, code):
    async with make_client(make_app()) as client:
        response = await client.request(method, path)

    assert response.status_code == status
    assert set(response.json()) == {"error", "message"}
    assert response.json()["error"] == code