"""POST /sync: save one finished chat turn into the session's history."""
from fastapi import APIRouter, Depends

from api.dependencies import get_session_manager
from api.schemas import SyncRequest, SyncResponse
from database.session_manager import SessionManager
from services.models import Turn

router = APIRouter(tags=["sync"])


@router.post("/sync", response_model=SyncResponse)
async def sync(body: SyncRequest, sessions: SessionManager = Depends(get_session_manager)) -> SyncResponse:
    turn = Turn(index=body.turn.index, role=body.turn.role, text=body.turn.text)
    turn_count = await sessions.add_turn(body.session_id, turn)
    return SyncResponse(turn_count=turn_count)