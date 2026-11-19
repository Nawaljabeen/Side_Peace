"""Settings come from environment variables or a .env file; the API key must never leak (REQ-F02)."""
import pytest

from errors import ConfigError
from settings import (
    DEFAULT_DB_PATH,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_CONTEXT_TURNS,
    load_env_file,
    load_settings,
)

KEY = "SECRET-KEY-12345"


def test_key_is_required_and_the_error_does_not_leak_anything():
    with pytest.raises(ConfigError) as excinfo:
        load_settings({})

    assert "GEMINI_API_KEY" in str(excinfo.value)


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_key_counts_as_missing(blank):
    with pytest.raises(ConfigError):
        load_settings({"GEMINI_API_KEY": blank})


def test_defaults_are_used_when_only_the_key_is_given():
    settings = load_settings({"GEMINI_API_KEY": KEY})

    assert settings.gemini_api_key == KEY
    assert settings.gemini_model == DEFAULT_GEMINI_MODEL
    assert settings.db_path == DEFAULT_DB_PATH
    assert settings.max_context_turns == DEFAULT_MAX_CONTEXT_TURNS
    assert settings.max_context_tokens == DEFAULT_MAX_CONTEXT_TOKENS


def test_every_value_can_be_overridden():
    settings = load_settings(
        {
            "GEMINI_API_KEY": KEY,
            "GEMINI_MODEL": "other-model",
            "SIDEPEACE_DB_PATH": "data/test.db",
            "MAX_CONTEXT_TURNS": "5",
            "MAX_CONTEXT_TOKENS": "1000",
        }
    )

    assert settings.gemini_model == "other-model"
    assert settings.db_path == "data/test.db"
    assert settings.max_context_turns == 5
    assert settings.max_context_tokens == 1000


@pytest.mark.parametrize("name", ["MAX_CONTEXT_TURNS", "MAX_CONTEXT_TOKENS"])
@pytest.mark.parametrize("value", ["abc", "0", "-3", "1.5", ""])
def test_bad_numbers_are_rejected(name, value):
    with pytest.raises(ConfigError):
        load_settings({"GEMINI_API_KEY": KEY, name: value})

@pytest.mark.parametrize("name", ["MAX_CONTEXT_TURNS", "MAX_CONTEXT_TOKENS"])
@pytest.mark.parametrize("value", ["²", "٣", "①"])
def test_non_ascii_digits_are_rejected_with_a_config_error(name, value):
    with pytest.raises(ConfigError):
        load_settings({"GEMINI_API_KEY": KEY, name: value})


def test_settings_repr_hides_the_key():
    settings = load_settings({"GEMINI_API_KEY": KEY})

    assert KEY not in repr(settings)
    assert KEY not in str(settings)


def test_env_file_is_parsed(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# a comment\n"
        "\n"
        f"GEMINI_API_KEY={KEY}\n"
        'GEMINI_MODEL="quoted-model"\n'
        "SIDEPEACE_DB_PATH = spaced.db\n"
        "not a valid line\n",
        encoding="utf-8",
    )

    values = load_env_file(env_file)

    assert values == {"GEMINI_API_KEY": KEY, "GEMINI_MODEL": "quoted-model", "SIDEPEACE_DB_PATH": "spaced.db"}


def test_missing_env_file_gives_no_values(tmp_path):
    assert load_env_file(tmp_path / "does-not-exist.env") == {}


def test_real_environment_wins_over_the_env_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(f"GEMINI_API_KEY=from-file\nGEMINI_MODEL=file-model\n", encoding="utf-8")

    settings = load_settings({"GEMINI_API_KEY": KEY}, env_file=env_file)

    assert settings.gemini_api_key == KEY
    assert settings.gemini_model == "file-model"


def test_unreadable_env_file_is_a_config_error(tmp_path):
    with pytest.raises(ConfigError):
        load_env_file(tmp_path)  # a folder, not a file: reading it fails