# SOLID evidence for Ammar's modules (SE423 M2 draft, real files only)

Draft input for the "Patterns and SOLID" section. Covers only code that exists on the PR branches; add
Nawal's and Nazaar's modules after they merge. PromptFactory is a simple factory, NOT one of the three
required patterns (Singleton, Adapter, Observer belong to others' code).

| Principle | Where | Evidence |
|---|---|---|
| SRP | `backend/services/context_pruner.py` | Only trims turns to limits; no storage, no HTTP. `prompt_factory.py` only builds prompt text; `sidePanelController.js` only handles panel input/output. |
| OCP | `ContextPruner(token_counter=...)` | A different token counting strategy is injected without editing `prune`; test `test_injected_token_counter_is_used`. |
| LSP | `Turn` consumers | Pruner and factory accept any `Turn` list (frozen dataclass from `models.py`), no type checks on subclasses needed. |
| ISP | `SidePanelController` | Depends only on `bridge.sendQuery(text)`, not on the whole bridge. |
| DIP | `SidePanelController(bridge, elements)` | Bridge injected, so tests use a fake bridge (`extension/tests/sidePanelController.test.js`); the pruner has no import of storage. |

## Defensive programming evidence
- `ContextPruner.__init__` raises `ValueError` for non-positive limits.
- `PromptFactory.build_sidekick_prompt` rejects blank and over-2000-char questions.
- Panel renders with `textContent` only (XSS test), catches bridge failures and ignores stale responses.

## Open item
Hard-coded token estimate (`len/4`) is an approximation, documented in `approximate_token_count`.
