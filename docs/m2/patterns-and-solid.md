# SE423 M2: Patterns and SOLID (draft, Ammar) - real files on `main` at `e0192a5`

Draft of the "Patterns and SOLID" section. Every claim names a real file; the Observer row is verified against `DOMObserver` (merged in PR #40). `PromptFactory` is a simple factory and is **not** claimed as one of the three patterns.

## Required patterns
| Pattern | Where (real file) | Is it real? | Evidence / caveat |
|---|---|---|---|
| Singleton (creational) | `backend/database/sqlite_adapter.py`: `SQLiteAdapter._instance`, `get_instance()`, `reset_instance()` | Yes: one adapter owns the one connection; asking for a different DB path raises `StorageError`. | `test_sqlite_adapter.py`. Caveat: first creation is not thread-safe (candidate finding P-1 in `docs/sqa/fagan-moderator-prep.md`, reproduced). |
| Adapter (structural) | `backend/services/gemini_adapter.py`: `GeminiAdapter(AbstractLLMProvider)` translates our `generate_response(prompt)` to Google's REST body and maps Google failures to our typed errors | Yes: all Google-specific shapes stay in this file. | `test_gemini_adapter.py` (MockTransport, no network); white-box paths in `test_whitebox_paths.py` |
| Observer (behavioral) | `extension/content/domObserver.js`: `DOMObserver` is the Subject: `subscribe(listener)` returns an unsubscribe function, subscribers are validated, `scan()` notifies every subscriber for each new or changed turn, and one failing subscriber does not stop the others (`#notify`). Merged in PR #40; replaced-chat handling added in PR #48 | Yes: verified by reading the file and by `tests/domObserver.test.js` and `domObserver.reset.test.js` (85 tests) | Caveat: before PR #48 the reported-turn memory was never cleared, so a new chat with the same first text lost turn 0 (found in review, reproduced, fixed test-first). |

## SOLID, with real files
| Principle | Where | Why it holds |
|---|---|---|
| SRP | `backend/services/context_pruner.py` (only trims turns); `backend/services/prompt_factory.py` (only builds the prompt); `backend/database/write_queue.py` (only orders writes); `backend/api/error_handlers.py` (only maps errors); `extension/sidepanel/sidePanelController.js` (only panel input/output) | Each file changes for one reason; none touches the others' concerns. |
| OCP | `backend/services/llm_provider.py`: `AbstractLLMProvider`; routes depend on it, `GeminiAdapter` is one implementation | A new LLM is a new subclass; `api/query.py` does not change. `ContextPruner(token_counter=...)` is also open for a different counting strategy. |
| LSP | `backend/database/memory_adapter.py` and `sqlite_adapter.py` both pass the same contract tests in `backend/tests/test_storage_contract.py` | The in-memory fake substitutes for SQLite everywhere (`SessionManager` tests use it). |
| ISP | `backend/database/base.py`: `MessageReader` and `MessageWriter` split from `AbstractStorageAdapter` | Read-only code needs only `get_turns`; `SidePanelController` needs only `bridge.sendQuery`. |
| DIP | `backend/database/session_manager.py`: `SessionManager(storage, pruner)` takes an interface and a protocol; `backend/main.py`: `create_app(provider, storage, pruner)`; `sidePanelController.js` takes the bridge in its constructor | High-level code never imports sqlite3 or a concrete LLM; tests inject fakes. |

## Defensive programming and concurrency (cross-references)
Strict request schemas (`backend/api/schemas.py`), contract-shaped errors with fixed messages (`error_handlers.py`), `textContent`-only rendering in the panel, and a single-consumer
write queue plus a connection lock (`write_queue.py`, `sqlite_adapter.py`, `docs/thread-safety.md`; 50 concurrent requests tested in `test_concurrency.py`).
