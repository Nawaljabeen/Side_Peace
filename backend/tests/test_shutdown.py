"""Shutdown hooks release resources (HTTP client, database) when the server stops."""
import logging

from fastapi.testclient import TestClient

from tests.app_helpers import make_app


def test_shutdown_hooks_run_when_the_app_stops():
    calls: list[str] = []

    async def close_something() -> None:
        calls.append("closed")

    with TestClient(make_app(shutdown_hooks=[close_something])):
        assert calls == []

    assert calls == ["closed"]


def test_a_failing_hook_does_not_stop_the_others(caplog):
    calls: list[str] = []

    async def broken() -> None:
        raise RuntimeError("cannot close with secret detail")

    async def fine() -> None:
        calls.append("fine")

    with caplog.at_level(logging.ERROR, logger="sidepeace"):
        with TestClient(make_app(shutdown_hooks=[broken, fine])):
            pass

    assert calls == ["fine"]
    assert "shutdown hook failed" in caplog.text
    assert "secret" not in caplog.text