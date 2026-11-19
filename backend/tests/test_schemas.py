"""Black-box tests for the request/response schemas (REQ-F02). Limits come from docs/api-contract.md."""
import pytest
from pydantic import ValidationError

from api.schemas import QueryRequest, QueryResponse, SyncRequest, SyncResponse, TurnIn
from services.models import MAX_TURN_TEXT_LENGTH
from services.prompt_factory import MAX_QUESTION_LENGTH

VALID_TURN = {"index": 0, "role": "user", "text": "hello"}


# --- session_id: 1-64 chars of A-Za-z0-9_- ---------------------------------

@pytest.mark.parametrize("session_id", ["a", "gemini-7f3a9c", "A_b-9", "x" * 64])
def test_valid_session_ids_are_accepted(session_id):
    assert QueryRequest(session_id=session_id, text="hi").session_id == session_id
    assert SyncRequest(session_id=session_id, turn=VALID_TURN).session_id == session_id


@pytest.mark.parametrize("session_id", ["", "x" * 65, "has space", "semi;colon", "a/b", "caf\u00e9", None, 123])
def test_invalid_session_ids_are_rejected(session_id):
    with pytest.raises(ValidationError):
        QueryRequest(session_id=session_id, text="hi")
    with pytest.raises(ValidationError):
        SyncRequest(session_id=session_id, turn=VALID_TURN)


# --- /query text: 1-2000 chars, not blank ----------------------------------

@pytest.mark.parametrize("length", [1, 2, 500, 1999, 2000])
def test_query_text_lengths_inside_the_limit_are_accepted(length):
    assert len(QueryRequest(session_id="s1", text="x" * length).text) == length


@pytest.mark.parametrize("text", ["", "x" * 2001, "   ", "\n\t", None, 123])
def test_invalid_query_text_is_rejected(text):
    with pytest.raises(ValidationError):
        QueryRequest(session_id="s1", text=text)


def test_query_limit_is_the_shared_constant():
    assert MAX_QUESTION_LENGTH == 2000
    QueryRequest(session_id="s1", text="x" * MAX_QUESTION_LENGTH)
    with pytest.raises(ValidationError):
        QueryRequest(session_id="s1", text="x" * (MAX_QUESTION_LENGTH + 1))


# --- synced turn: index >= 0, role user/model, text 1-20000 -----------------

@pytest.mark.parametrize("index", [0, 1, 1000])
def test_valid_turn_index_is_accepted(index):
    assert TurnIn(index=index, role="user", text="hi").index == index


@pytest.mark.parametrize("index", [-1, 1.5, "0", None, True])
def test_invalid_turn_index_is_rejected(index):
    with pytest.raises(ValidationError):
        TurnIn(index=index, role="user", text="hi")


@pytest.mark.parametrize("role", ["user", "model"])
def test_valid_turn_roles_are_accepted(role):
    assert TurnIn(index=0, role=role, text="hi").role == role


@pytest.mark.parametrize("role", ["system", "User", "", None])
def test_invalid_turn_roles_are_rejected(role):
    with pytest.raises(ValidationError):
        TurnIn(index=0, role=role, text="hi")


@pytest.mark.parametrize("length", [1, 2, 19999, MAX_TURN_TEXT_LENGTH])
def test_turn_text_lengths_inside_the_limit_are_accepted(length):
    assert len(TurnIn(index=0, role="user", text="x" * length).text) == length


@pytest.mark.parametrize("text", ["", "x" * (MAX_TURN_TEXT_LENGTH + 1), None, 123])
def test_invalid_turn_text_is_rejected(text):
    with pytest.raises(ValidationError):
        TurnIn(index=0, role="user", text=text)


def test_missing_fields_are_rejected():
    with pytest.raises(ValidationError):
        SyncRequest(session_id="s1")
    with pytest.raises(ValidationError):
        QueryRequest(session_id="s1")


# --- responses match docs/contract/*.json -----------------------------------

def test_sync_response_defaults_to_status_ok():
    assert SyncResponse(turn_count=3).model_dump() == {"status": "ok", "turn_count": 3}


def test_query_response_has_only_an_answer():
    assert QueryResponse(answer="yes").model_dump() == {"answer": "yes"}