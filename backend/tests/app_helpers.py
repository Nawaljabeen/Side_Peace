"""Helpers that build the real app with injected fakes (no network, no real database file)."""
import httpx
from fastapi import FastAPI

from database.base import AbstractStorageAdapter
from database.memory_adapter import InMemoryAdapter
from main import create_app
from services.llm_provider import AbstractLLMProvider
from tests.fakes import FakeProvider


def make_app(
    provider: AbstractLLMProvider | None = None,
    storage: AbstractStorageAdapter | None = None,
    pruner=None,
    **kwargs,
) -> FastAPI:
    return create_app(provider or FakeProvider(), storage or InMemoryAdapter(), pruner, **kwargs)


def make_client(app: FastAPI) -> httpx.AsyncClient:
    # raise_app_exceptions=False: behave like a real server and hand back the 500 response
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://test")