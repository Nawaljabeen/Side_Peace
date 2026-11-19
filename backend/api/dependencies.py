"""FastAPI dependencies: routers receive their collaborators from app.state (set by create_app)."""
from fastapi import Request

from database.session_manager import SessionManager
from services.llm_provider import AbstractLLMProvider


def get_session_manager(request: Request) -> SessionManager:
    return request.app.state.sessions


def get_provider(request: Request) -> AbstractLLMProvider:
    return request.app.state.provider