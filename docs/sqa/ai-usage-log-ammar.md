# AI Usage Log - Muhammad Ammar Zahid (IDs AI-A01...), for merging into the team log by Nawal

Tool for every entry: Claude Code (Sonnet 5.5). Verification below was actually run on 2026-11-19 with Node v22.23.5 and Python 3.12.3.
"Modifications" records only what changed between the AI output and what was committed; Ammar must correct any entry where he edited something himself.

| ID | Purpose | Prompt summary | Material adopted | Modifications | Verification |
|---|---|---|---|---|---|
| AI-A01 | Understand project and onboarding guide; clone repo, create `ammar` branch | Gave guide + M1 PDFs, asked to explain project and my role | Project/role summary; `Turn(index, role, text)` correction | None to the code; branch kept local as base | Read `backend/services/models.py` in the clone to confirm Turn fields |
| AI-A02 | Git identity, branching rules review, progress notes | Asked what branch system the repo uses and to set my email | Identity settings; branch advice from README | user.name set to full name "Muhammad Ammar Zahid" at my request | `git config user.name` / `user.email` show the expected values |
| AI-A03 | ContextPruner via TDD | Asked for the pruner step by step with red/green commits | `backend/services/context_pruner.py` and `backend/tests/test_context_pruner.py` as committed | Boundary/property tests are labelled `boundary`/`property` because they passed on first run (not red) | `pytest --cov=services` on `feature/context-pruner`: 72 passed, context_pruner.py 100% |
| AI-A04 | PromptFactory via TDD | Asked for factory with context+question, validation, no secrets | `prompt_factory.py` and its tests | An edit script silently failed; branch reset to the first green commit and the pairs redone | `pytest --cov=services` on `feature/prompt-factory`: 67 passed, prompt_factory.py 100% |
| AI-A05 | SidePanelController + UI via Vitest TDD | Asked for controller, DIP bridge, XSS/network/stale tests | `sidePanelController.js`, `shared/constants.js`, panel HTML/CSS/demo wiring, tests | Demo fake bridge is temporary until ExtensionBridge merges | `npm test` on `feature/panel-controller`: 12 passed; eslint clean |
| AI-A06 | SQA docs: Fagan checklist, white-box analysis | Asked to draft checklist and CFG/V(G) from the built code | `fagan-checklist.md`, `whitebox-context-pruner.md`, `solid-evidence-ammar.md` | Defect log left empty on purpose (no real inspection yet) | V(G) recomputed by hand: E=6, N=5, 6-5+2=3; paths map to existing tests |
| AI-A07 | Push branches, create issues #15-#18 and PRs #19-#22 | Asked to push and open PRs after approval | Issue/PR text | None | `gh pr checks`: both required checks passed on all four PRs |
| AI-A08 | Node upgrade, CFG diagram, this log | Asked to upgrade Node, draw CFG, fill the log | Node 22.23.5 via winget; `pruner-cfg.drawio/.svg/.png` | PNG rendered with local headless Chrome from the SVG | `node --version` = v22.23.5; backend 60 and extension 5 tests pass on this branch; image viewed |
