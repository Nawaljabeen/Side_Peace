# Fagan inspection: Moderator's preparation notes (Ammar)

Frozen SHA `e0192a5`; scope = the Author's 8-file list (421 lines), see `fagan-checklist.md`. These are **preparation notes**, not the inspection
log: the defect log is filled in at the meeting, with the Reader/Recorder, and the other inspectors' findings. Only items I could reproduce or
point to a line for are listed. Two suspicions I tested and **dropped** because the code is correct: a session id with a trailing newline is
rejected by the schema, and the database CHECK constraints (`schema.sql`) stop a malformed row from ever being stored.

## Candidate finding (reproduced)
| ID | file:line | Description | Type | Severity (proposed) |
|---|---|---|---|---|
| P-1 | `backend/database/sqlite_adapter.py:50-56` | `SQLiteAdapter.get_instance` is check-then-set with no lock. Reproduced on the frozen code: 6 threads calling `get_instance(path)` at the same moment (constructor slowed by 50 ms to widen the window) created **2 distinct instances**, and the other 4 failed with `database is locked` -> `StorageError`. So the Singleton guarantee ("one connection") does not hold under concurrent first use. In production `server.py` calls it once at start-up, so the practical risk is low, but it is the class presented as the Singleton pattern. Suggested fix: a class-level `threading.Lock` around the check-and-create, plus a test with a barrier. | concurrency | Minor (Major if the instance is ever created from request threads) |

## Observations for discussion (read from the code, not reproduced)
| ID | file:line | Observation |
|---|---|---|
| O-1 | `backend/database/write_queue.py:16` | `asyncio.Queue()` has no `maxsize`, so there is no back-pressure: under a flood of `/sync` calls the queue (and memory) grows without limit. |
| O-2 | `backend/services/gemini_adapter.py:53-54` | `aclose()` closes the `httpx.AsyncClient` even when it was injected by the caller (ownership is unclear). Harmless today (`server.py` owns both). |
| O-3 | `backend/api/query.py` and `gemini_adapter.py` | The empty-answer check exists in both places (route and adapter). Defensive, but duplicated; confirm which layer owns it. |

## Checklist coverage (C1-C12), by file
Validation (C1): `schemas.py` strict models, shared length constants, blank text rejected. Specific exceptions (C2): no bare `except:`;
`write_queue.py:43` catches `Exception` but forwards it to the awaiting caller (acceptable, commented). Logging without secrets (C3): fixed messages in
`error_handlers.py`, key only in the `x-goog-api-key` header (`gemini_adapter.py`). Shared state (C4): lock around every connection use
(`sqlite_adapter.py:83,90`) plus the single-consumer queue. SQL (C5): every statement is parameterised. Traceability (C10): the Author's table gives the
requirement ID per file; `sync.py` and `query.py` still need one stated.
