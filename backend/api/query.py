"""POST /query: answer a side question from the session's pruned history, without touching the main chat.

The question and the answer are NOT stored (M2 decision): the side panel keeps its own display.
"""
from fastapi import APIRouter, Depends, Response

from api.dependencies import get_provider, get_session_manager
from api.schemas import QueryRequest, QueryResponse
from database.session_manager import SessionManager
from errors import ProviderBadResponseError
from services.llm_provider import AbstractLLMProvider
from services.prompt_factory import PromptFactory

router = APIRouter(tags=["query"])


@router.post("/query", response_model=QueryResponse)
async def query(
    body: QueryRequest,
    response: Response,
    sessions: SessionManager = Depends(get_session_manager),
    provider: AbstractLLMProvider = Depends(get_provider),
) -> QueryResponse:
    context = await sessions.get_pruned_context(body.session_id)
    prompt = PromptFactory.build_sidekick_prompt(context, body.text)
    answer = await provider.generate_response(prompt)
    if not answer.strip():
        raise ProviderBadResponseError("the provider returned an empty answer")
    response.headers["Cache-Control"] = "no-store"
    return QueryResponse(answer=answer)