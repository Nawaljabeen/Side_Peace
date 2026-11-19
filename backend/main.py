from fastapi import FastAPI

from api.error_handlers import register_error_handlers
from api.health import router as health_router
from api.query import router as query_router
from api.sync import router as sync_router
from database.base import AbstractStorageAdapter
from database.session_manager import Pruner, SessionManager
from services.context_pruner import ContextPruner
from services.llm_provider import AbstractLLMProvider
from settings import DEFAULT_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TURNS


def create_app(
    provider: AbstractLLMProvider,
    storage: AbstractStorageAdapter,
    pruner: Pruner | None = None,
) -> FastAPI:
    app = FastAPI(title="SidePeace Gateway", version="0.2.0")
    app.state.provider = provider
    app.state.sessions = SessionManager(
        storage, pruner or ContextPruner(DEFAULT_MAX_CONTEXT_TURNS, DEFAULT_MAX_CONTEXT_TOKENS)
    )
    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(sync_router)
    app.include_router(query_router)
    return app