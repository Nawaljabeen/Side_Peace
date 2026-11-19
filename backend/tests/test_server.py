"""Composition root (server.py): the only place that builds the real Gemini adapter and SQLite database."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import server
from database.sqlite_adapter import SQLiteAdapter
from errors import ConfigError
from services.gemini_adapter import GeminiAdapter
from settings import Settings, load_env_file, load_settings

KEY = "SECRET-KEY-12345"


@pytest.fixture(autouse=True)
def fresh_singleton():
    SQLiteAdapter.reset_instance()
    yield
    SQLiteAdapter.reset_instance()


def make_settings(tmp_path: Path) -> Settings:
    return load_settings({"GEMINI_API_KEY": KEY, "SIDEPEACE_DB_PATH": str(tmp_path / "test.db")})


def test_production_app_uses_gemini_and_a_real_database_file(tmp_path):
    app = server.build_production_app(make_settings(tmp_path))

    assert isinstance(app.state.provider, GeminiAdapter)
    assert (tmp_path / "test.db").exists()


def test_production_app_saves_turns_in_sqlite(tmp_path):
    with TestClient(server.build_production_app(make_settings(tmp_path))) as client:
        body = {"session_id": "s1", "turn": {"index": 0, "role": "user", "text": "hello"}}
        first = client.post("/sync", json=body)
        second = client.post("/sync", json={**body, "turn": {**body["turn"], "index": 1}})

    assert first.json() == {"status": "ok", "turn_count": 1}
    assert second.json() == {"status": "ok", "turn_count": 2}


def test_stopping_the_app_closes_the_database_singleton(tmp_path):
    with TestClient(server.build_production_app(make_settings(tmp_path))):
        assert SQLiteAdapter._instance is not None

    assert SQLiteAdapter._instance is None


def test_main_refuses_to_start_without_a_key_and_prints_no_secret(tmp_path, capsys):
    started = []

    exit_code = server.main(environ={}, env_file=tmp_path / "missing.env", run=lambda *a, **k: started.append(a))

    assert exit_code == 1
    assert started == []
    assert "GEMINI_API_KEY" in capsys.readouterr().err


def test_main_serves_on_localhost_only(tmp_path):
    calls = []
    environ = {"GEMINI_API_KEY": KEY, "SIDEPEACE_DB_PATH": str(tmp_path / "test.db")}

    exit_code = server.main(environ=environ, env_file=tmp_path / "missing.env", run=lambda app, **kw: calls.append(kw))

    assert exit_code == 0
    assert calls == [{"host": "127.0.0.1", "port": 8000}]


def test_main_reports_a_database_that_cannot_be_opened(tmp_path, capsys):
    environ = {"GEMINI_API_KEY": KEY, "SIDEPEACE_DB_PATH": str(tmp_path / "no-such-folder" / "x.db")}

    exit_code = server.main(environ=environ, env_file=tmp_path / "missing.env", run=lambda *a, **k: None)

    assert exit_code == 1
    assert KEY not in capsys.readouterr().err


def test_env_example_documents_every_setting_and_holds_no_key():
    example = Path(server.__file__).with_name(".env.example")

    values = load_env_file(example)

    assert set(values) == {
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "SIDEPEACE_DB_PATH",
        "MAX_CONTEXT_TURNS",
        "MAX_CONTEXT_TOKENS",
    }
    assert values["GEMINI_API_KEY"] == ""
    with pytest.raises(ConfigError):
        load_settings({}, env_file=example)