from tests.app_helpers import make_app, make_client


async def test_health_returns_ok():
    async with make_client(make_app()) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}