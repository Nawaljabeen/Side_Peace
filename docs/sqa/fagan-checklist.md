# Fagan Inspection Checklist (SE431, moderator: Muhammad Ammar Zahid)

Artifact: Nazaar's Storage + Gateway code, frozen at a recorded commit SHA (fill in at planning).
Roles: Moderator = Ammar, Author = Nazaar, Reader/Recorder = Nawal, plus one inspector from another team.

## Planning record
| Item | Value |
|---|---|
| Frozen commit SHA | `e0192a5` (merge of PR #28 on `main`), announced by the Author (Nazaar) |
| Roles | Moderator: Ammar Zahid; Author: Nazaar Khalid; Reader/Recorder: Nawal Jabeen; outside inspector: see below |
| Scope (about 426 lines at the SHA) | `backend/database/`: `base.py` 23, `memory_adapter.py` 18, `session_manager.py` 27, `sqlite_adapter.py` 108, `write_queue.py` 49, `schema.sql` 11 (236). `backend/api/`: `dependencies.py` 12, `error_handlers.py` 79, `health.py` 7, `query.py` 29, `schemas.py` 48, `sync.py` 15 (190). Counts from `git show e0192a5:<file> | wc -l`. The Author's own scope list is the authority; this table is the Moderator's reconstruction and must be confirmed |
| Not in scope | `main.py`, `server.py`, `settings.py`, `errors.py`, `services/gemini_adapter.py`, `services/llm_provider.py` (284 lines), and the Moderator's own modules |
| Preparation effort | about 150-200 lines/hour, so about 2-3 hours per inspector for 426 lines |
| Meeting date | _TBD (to be booked; week 9)_ |
| Outside inspector | _TBD (Nawal asked the instructor which team)_ |
| Author's overview | to be sent by the Author before the meeting |

### Known item declared by the Author before the inspection
`settings.py` accepts non-ASCII digits (`isdigit()`): reported in the PR #28 review and fixed in PR #35 (separate branch, after the frozen SHA). It is outside the frozen scope, so it is not an inspection finding; it is listed here for traceability only.

## Checklist (answer Yes / No / N/A per file, cite file:line for every No)
| # | Question | Defect type if No |
|---|---|---|
| C1 | Is every input validated at the boundary (type, range, length, allowed characters)? | validation |
| C2 | Are only specific exceptions caught (no bare `except:`, no `except Exception: pass`)? | error-handling |
| C3 | Are errors logged without secrets (no API key, no full prompt text)? | security |
| C4 | Is shared state protected (single writer queue, no unguarded mutable globals)? | concurrency |
| C5 | Are all SQL statements parameterised (no string formatting into SQL)? | security |
| C6 | Does each class have one responsibility, and do high-level modules depend on abstractions? | SOLID |
| C7 | Are names clear and consistent with the API contract (`session_id`, `turn`, `index`)? | naming |
| C8 | Is there dead code, commented-out code or unused imports? | logic |
| C9 | Does every logic branch have a test, and is each test meaningful? | logic |
| C10 | Can each function be traced to a requirement ID (REQ-F/Q)? | logic |
| C11 | Do error responses match `{error, message}` and the documented status codes? | validation |
| C12 | Are timeouts and provider failures mapped to the contract codes (429, 502, 504)? | error-handling |

## Defect log (log only real findings from the inspected code)
| ID | file:line | Description | Type | Severity | Found by | CAPA action | Owner | Due | Status | Fix commit |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

## Phases and timing
Planning (week 8) -> overview (10 min) -> preparation (2-3 days, about 150-200 lines/hour) -> meeting (reader paraphrases, no fixing) -> rework -> follow-up verified by the moderator (week 10).
