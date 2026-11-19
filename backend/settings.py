"""Start-up settings: environment variables first, then a .env file, then defaults.

The Gemini API key is only ever read here. It is hidden from repr() so it cannot leak into
logs or tracebacks by accident, and the errors in this file never contain a value.
"""
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from errors import ConfigError

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
DEFAULT_DB_PATH = "sidepeace.db"
DEFAULT_MAX_CONTEXT_TURNS = 20
DEFAULT_MAX_CONTEXT_TOKENS = 6000


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(repr=False)
    gemini_model: str
    db_path: str
    max_context_turns: int
    max_context_tokens: int


def load_env_file(path: Path) -> dict[str, str]:
    """Read KEY=VALUE lines. Comments, blank lines and malformed lines are skipped."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError as exc:
        raise ConfigError("the .env file could not be read") from exc

    values: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name, value = name.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if name:
            values[name] = value
    return values


def _positive_int(values: Mapping[str, str], name: str, default: int) -> int:
    if name not in values:
        return default
    raw = values[name].strip()
    if not (raw.isascii() and raw.isdigit()) or int(raw) <= 0:
        raise ConfigError(f"{name} must be a whole number greater than 0")
    return int(raw)


def load_settings(environ: Mapping[str, str] | None = None, env_file: Path | None = None) -> Settings:
    """Build Settings. Real environment variables win over the .env file."""
    values = dict(load_env_file(env_file)) if env_file is not None else {}
    values.update(os.environ if environ is None else environ)

    api_key = values.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ConfigError("GEMINI_API_KEY is not set. Put it in backend/.env (see backend/.env.example).")

    return Settings(
        gemini_api_key=api_key,
        gemini_model=values.get("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL,
        db_path=values.get("SIDEPEACE_DB_PATH", "").strip() or DEFAULT_DB_PATH,
        max_context_turns=_positive_int(values, "MAX_CONTEXT_TURNS", DEFAULT_MAX_CONTEXT_TURNS),
        max_context_tokens=_positive_int(values, "MAX_CONTEXT_TOKENS", DEFAULT_MAX_CONTEXT_TOKENS),
    )