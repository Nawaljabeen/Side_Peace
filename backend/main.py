import logging
from collections.abc import Awaitable, Callable, Sequence
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.error_handlers import register_error_handlers
from api.health import router as health_router
from api.query import router as query_router
from api.sync import router as sync_router
from database.base import AbstractStorageAdapter
from database.session_manager import Pruner, SessionManager
from services.context_pruner import ContextPruner
from services.llm_provider import AbstractLLMProvider
from settings import DEFAULT_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TURNS

logger = logging.getLogger("sidepeace")

# Chrome extension ids are 32 letters a-p. Only extension pages may call the API from a browser.
EXTENSION_ORIGIN_REGEX = r"^chrome-extension://[a-p]{32}$"

ShutdownHook = Callable[[], Awaitable[None]]


def create_app(
    provider: AbstractLLMProvider,
    storage: AbstractStorageAdapter,
    pruner: Pruner | None = None,
    *,
    shutdown_hooks: Sequence[ShutdownHook] = (),
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        for hook in shutdown_hooks:
            try:
                await hook()
            except Exception as exc:  # one failing cleanup must not stop the others
                logger.error("shutdown hook failed: %s", type(exc).__name__)

    app = FastAPI(title="SidePeace Gateway", version="0.2.0", lifespan=lifespan)
    app.state.provider = provider
    app.state.sessions = SessionManager(
        storage, pruner or ContextPruner(DEFAULT_MAX_CONTEXT_TURNS, DEFAULT_MAX_CONTEXT_TOKENS)
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=EXTENSION_ORIGIN_REGEX,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(sync_router)
    app.include_router(query_router)
    return app