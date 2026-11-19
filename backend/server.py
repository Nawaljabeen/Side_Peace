"""Composition root: the one place that builds the real Gemini adapter and the SQLite database.

Run from the backend folder:  python server.py
"""
import logging
import sys
from collections.abc import Callable, Mapping
from pathlib import Path

import uvicorn
from fastapi import FastAPI

from database.sqlite_adapter import SQLiteAdapter
from errors import SidePeaceError
from main import create_app
from services.context_pruner import ContextPruner
from services.gemini_adapter import GeminiAdapter
from settings import Settings, load_settings

ENV_FILE = Path(__file__).with_name(".env")
HOST = "127.0.0.1"  # this computer only; the extension talks to http://localhost:8000
PORT = 8000


def build_production_app(settings: Settings) -> FastAPI:
    provider = GeminiAdapter(api_key=settings.gemini_api_key, model=settings.gemini_model)
    storage = SQLiteAdapter.get_instance(settings.db_path)
    pruner = ContextPruner(settings.max_context_turns, settings.max_context_tokens)

    async def close_storage() -> None:
        SQLiteAdapter.reset_instance()

    return create_app(provider, storage, pruner, shutdown_hooks=[provider.aclose, close_storage])


def main(
    environ: Mapping[str, str] | None = None,
    env_file: Path = ENV_FILE,
    run: Callable[..., None] = uvicorn.run,
) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        app = build_production_app(load_settings(environ, env_file=env_file))
    except SidePeaceError as exc:
        print(f"Cannot start the SidePeace server: {exc}", file=sys.stderr)
        return 1
    run(app, host=HOST, port=PORT)
    return 0


if __name__ == "__main__":
    sys.exit(main())