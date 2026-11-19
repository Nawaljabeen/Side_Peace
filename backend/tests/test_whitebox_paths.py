"""White-box basis-path tests (SE431). One named test per basis path of each function.

Paths are derived from the control flow graphs in docs/sqa/whitebox-session-gemini.md, drawn from the
code on main (radon cc: get_pruned_context V(G)=1, generate_response V(G)=5, _extract_text V(G)=4).
Requirements: REQ-F03 (session history), REQ-Q02 (provider failures become typed errors).
"""
import httpx
import pytest

from database.memory_adapter import InMemoryAdapter
from database.session_manager import SessionManager
from errors import ProviderBadResponseError, ProviderRateLimitError, ProviderTimeoutError
from services.gemini_adapter import GeminiAdapter
from services.models import Turn


def adapter_with(handler) -> GeminiAdapter:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return GeminiAdapter(api_key="k", model="m", client=client)


def ok_body(*texts: str) -> dict:
    return {"candidates": [{"content": {"parts": [{"text": t} for t in texts]}}]}


# ---- SessionManager.get_pruned_context: V(G) = 1, a single basis path -------------------------------------

class RecordingPruner:
    def __init__(self) -> None:
        self.received: list[list[Turn]] = []

    def prune(self, turns: list[Turn]) -> list[Turn]:
        self.received.append(list(turns))
        return turns[-1:]


async def test_wb_get_pruned_context_path1_reads_storage_then_returns_the_pruned_turns():
    """P1: N1 get_turns -> N2 prune -> return (no decisions)."""
    storage = InMemoryAdapter()
    await storage.add_turn("s", Turn(0, "user", "a"))
    await storage.add_turn("s", Turn(1, "model", "b"))
    pruner = RecordingPruner()

    result = await SessionManager(storage, pruner).get_pruned_context("s")

    assert pruner.received == [[Turn(0, "user", "a"), Turn(1, "model", "b")]]
    assert result == [Turn(1, "model", "b")]


# ---- GeminiAdapter.generate_response: V(G) = 5 ------------------------------------------------------------

async def test_wb_generate_response_path1_success_returns_the_text():
    """P1: N1 -> D1(no) -> D2(no) -> D3(no) -> D4(no) -> N10 extract -> return."""
    adapter = adapter_with(lambda request: httpx.Response(200, json=ok_body("hello")))
    assert await adapter.generate_response("hi") == "hello"


async def test_wb_generate_response_path2_timeout_raises_provider_timeout_error():
    """P2: D1 yes -> N6 raise ProviderTimeoutError."""
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(ProviderTimeoutError):
        await adapter_with(handler).generate_response("hi")


async def test_wb_generate_response_path3_other_http_error_raises_provider_bad_response_error():
    """P3: D1 no -> D2 yes -> N7 raise ProviderBadResponseError (provider could not be reached)."""
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ProviderBadResponseError, match="could not be reached"):
        await adapter_with(handler).generate_response("hi")


async def test_wb_generate_response_path4_status_429_raises_provider_rate_limit_error():
    """P4: D1 no -> D2 no -> D3 yes -> N8 raise ProviderRateLimitError."""
    with pytest.raises(ProviderRateLimitError):
        await adapter_with(lambda request: httpx.Response(429)).generate_response("hi")


async def test_wb_generate_response_path5_status_500_raises_provider_bad_response_error():
    """P5: D1 no -> D2 no -> D3 no -> D4 yes -> N9 raise ProviderBadResponseError (rejected)."""
    with pytest.raises(ProviderBadResponseError, match="rejected"):
        await adapter_with(lambda request: httpx.Response(500)).generate_response("hi")


# ---- GeminiAdapter._extract_text: V(G) = 4 ----------------------------------------------------------------

def test_wb_extract_text_path1_joins_the_parts_and_returns_the_text():
    """P1: N1 -> D1(no) -> D2(yes) -> B -> D2(no) -> D3(no) -> return."""
    assert GeminiAdapter._extract_text(httpx.Response(200, json=ok_body("a", "b"))) == "ab"


def test_wb_extract_text_path2_unexpected_shape_raises_provider_bad_response_error():
    """P2: D1 yes (KeyError/IndexError/ValueError/TypeError/AttributeError) -> raise (shape)."""
    with pytest.raises(ProviderBadResponseError, match="unexpected shape"):
        GeminiAdapter._extract_text(httpx.Response(200, json={"candidates": []}))


def test_wb_extract_text_path3_blank_text_raises_provider_bad_response_error():
    """P3: D1 no -> D2 yes -> B -> D2 no -> D3 yes -> raise (empty answer)."""
    with pytest.raises(ProviderBadResponseError, match="empty answer"):
        GeminiAdapter._extract_text(httpx.Response(200, json=ok_body("   ")))


def test_wb_extract_text_path4_zero_parts_raises_provider_bad_response_error():
    """P4: D1 no -> D2 no (loop body never runs) -> D3 yes -> raise (empty answer)."""
    with pytest.raises(ProviderBadResponseError, match="empty answer"):
        GeminiAdapter._extract_text(httpx.Response(200, json={"candidates": [{"content": {"parts": []}}]}))
