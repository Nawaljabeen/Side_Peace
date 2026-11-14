"""
notice to everyone, read:
create_app() is the application factory: tests build a fresh app per test,
and later waves will pass dependencies (LLM provider, storage) in here.
"""
from fastapi import FastAPI

from api.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="SidePeace Gateway", version="0.1.0")
    app.include_router(health_router)
    return app


app = create_app()