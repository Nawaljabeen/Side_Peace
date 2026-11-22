# Static analysis baseline (SE431)

*Baseline run on `main` at commit `ae1020c` (merge of PR #48), source code only (`backend/` without `tests/`, and `extension/`), re-checked on `ced879b` (merge of PR #52, 2026-11-22; the backend is identical, only `extension/` changed). Findings below come from the real tool output; raw output is stored next to this file in `static-analysis/` (files ending `_ced879b` are the re-check). Dispositions are the author's proposal and must be confirmed by the team; "Fix" rows have no fix commit yet.*

## 1. Tools and commands

| Area | Tool | Command (run from the repository root) | Result |
|---|---|---|---|
| Python quality | Pylint | `cd backend; pylint --ignore=tests --recursive=y .` | 81 findings, score 8.21/10 |
| Python quality/lint | Ruff | `ruff check backend --exclude backend/tests` | 16 findings (11 auto-fixable) |
| Python security | Bandit | `bandit -r backend -x backend/tests` | 0 issues in 615 lines (0 high / 0 medium / 0 low) |
| Python complexity | Radon | `radon cc backend -s -a --exclude "backend/tests/*"` (add `-nB` to list only blocks at B or worse) | 77 blocks, average A (2.32); 6 blocks at B or worse; 1 block above 10 |
| JavaScript | ESLint | `cd extension; npm run lint` | 0 problems in 25 files at `ae1020c`; 0 problems in 54 files at `ced879b` |
| JavaScript complexity | ESLint `complexity` rule, limit 10 | `cd extension; npx eslint --no-config-lookup --parser-options=ecmaVersion:latest,sourceType:module --rule '{"complexity":["warn",10]}' background content shared sidepanel` | `ced879b`: 1 function above 10, the `ExtensionBridge` constructor (15) |
| Dependencies | npm audit | `cd extension; npm audit --omit=dev` | `ced879b`: 0 vulnerabilities |
| JavaScript cycles (REQ-Q04) | Madge | `cd extension; npx madge --circular --extensions js .` | 0 circular dependencies |
| Manifest (QR-03) | Automated test | `cd extension; npm test -- manifest` | `host_permissions` lists only `https://gemini.google.com/*` and `http://localhost:8000/*` |

## 2. Baseline numbers (before any fix)

| Metric | Value |
|---|---|
| Pylint findings / score (source) | 81 / 8.21 |
| Ruff findings (source) | 16 |
| Bandit issues | 0 |
| Radon blocks analysed / average / above V(G) 10 | 77 / A (2.32) / 1 (`settings.py load_env_file`, V(G) 11) |
| ESLint problems | 0 |
| Circular dependencies | 0 (Madge for JavaScript; Pylint R0401 reports none for Python) |

Scope note: the Fagan inspection freezes the storage and gateway files at SHA `e0192a5`. Fixes in section 4 should be made **after** that inspection so the inspected code does not change underneath the inspectors.

## 3. Triage table (every finding in the tools above)

| ID | Tool and rule | File:line | Severity | Disposition | Reason | CAPA link | Fix commit |
|---|---|---|---|---|---|---|---|
| SA-001 | ruff I001 | `backend/api/dependencies.py:2` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-002 | pylint C0116 missing-function-docstring | `backend/api/dependencies.py:8` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-003 | pylint C0116 missing-function-docstring | `backend/api/dependencies.py:12` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-004 | pylint C0304 missing-final-newline | `backend/api/dependencies.py:13` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-005 | ruff I001 | `backend/api/error_handlers.py:6` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-006 | pylint C0301 line-too-long | `backend/api/error_handlers.py:25` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-007 | pylint C0301 line-too-long | `backend/api/error_handlers.py:26` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-008 | pylint C0116 missing-function-docstring | `backend/api/error_handlers.py:55` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-009 | pylint W0613 unused-argument | `backend/api/error_handlers.py:62` | Minor | False positive | Parameter is required by the framework signature (FastAPI lifespan / exception handler) even though the body does not use it. | | |
| SA-010 | pylint C0301 line-too-long | `backend/api/error_handlers.py:63` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-011 | pylint C0304 missing-final-newline | `backend/api/error_handlers.py:80` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-012 | pylint C0114 missing-module-docstring | `backend/api/health.py:1` | Minor | Deferred to M3 | Module docstring; add in M3. | | |
| SA-013 | pylint C0116 missing-function-docstring | `backend/api/health.py:7` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-014 | pylint C0304 missing-final-newline | `backend/api/health.py:8` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-015 | pylint C0301 line-too-long | `backend/api/query.py:1` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-016 | ruff I001 | `backend/api/query.py:5` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-017 | pylint C0116 missing-function-docstring | `backend/api/query.py:18` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-018 | ruff B008 | `backend/api/query.py:21` | Minor | False positive | `Depends(...)` in a default argument is the documented FastAPI pattern. Configure ruff `extend-immutable-calls = ["fastapi.Depends"]`. | | |
| SA-019 | ruff B008 | `backend/api/query.py:22` | Minor | False positive | `Depends(...)` in a default argument is the documented FastAPI pattern. Configure ruff `extend-immutable-calls = ["fastapi.Depends"]`. | | |
| SA-020 | pylint C0304 missing-final-newline | `backend/api/query.py:30` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-021 | ruff I001 | `backend/api/schemas.py:5` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-022 | pylint C0115 missing-class-docstring | `backend/api/schemas.py:20` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-023 | pylint C0115 missing-class-docstring | `backend/api/schemas.py:26` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-024 | pylint C0301 line-too-long | `backend/api/schemas.py:27` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-025 | pylint C0115 missing-class-docstring | `backend/api/schemas.py:31` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-026 | pylint C0115 missing-class-docstring | `backend/api/schemas.py:36` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-027 | pylint C0301 line-too-long | `backend/api/schemas.py:37` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-028 | pylint C0116 missing-function-docstring | `backend/api/schemas.py:42` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-029 | pylint C0115 missing-class-docstring | `backend/api/schemas.py:48` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-030 | pylint C0304 missing-final-newline | `backend/api/schemas.py:49` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-031 | ruff I001 | `backend/api/sync.py:2` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-032 | pylint C0116 missing-function-docstring | `backend/api/sync.py:13` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-033 | pylint C0301 line-too-long | `backend/api/sync.py:13` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-034 | ruff B008 | `backend/api/sync.py:13` | Minor | False positive | `Depends(...)` in a default argument is the documented FastAPI pattern. Configure ruff `extend-immutable-calls = ["fastapi.Depends"]`. | | |
| SA-035 | pylint C0304 missing-final-newline | `backend/api/sync.py:16` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-036 | pylint C0115 missing-class-docstring | `backend/database/base.py:11` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-037 | pylint R0903 too-few-public-methods | `backend/database/base.py:11` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-038 | pylint C0115 missing-class-docstring | `backend/database/base.py:17` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-039 | pylint R0903 too-few-public-methods | `backend/database/base.py:17` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-040 | pylint W0223 abstract-method | `backend/database/base.py:23` | Minor | False positive | AbstractStorageAdapter is itself abstract: it combines MessageReader and MessageWriter, so it must not implement their methods. | | |
| SA-041 | pylint W0223 abstract-method | `backend/database/base.py:23` | Minor | False positive | AbstractStorageAdapter is itself abstract: it combines MessageReader and MessageWriter, so it must not implement their methods. | | |
| SA-042 | pylint C0304 missing-final-newline | `backend/database/base.py:24` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-043 | ruff I001 | `backend/database/memory_adapter.py:2` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-044 | pylint C0301 line-too-long | `backend/database/memory_adapter.py:7` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-045 | pylint C0304 missing-final-newline | `backend/database/memory_adapter.py:19` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-046 | ruff I001 | `backend/database/session_manager.py:6` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-047 | pylint C0115 missing-class-docstring | `backend/database/session_manager.py:12` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-048 | pylint R0903 too-few-public-methods | `backend/database/session_manager.py:12` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-049 | pylint C0116 missing-function-docstring | `backend/database/session_manager.py:13` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-050 | pylint C0115 missing-class-docstring | `backend/database/session_manager.py:16` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-051 | pylint C0304 missing-final-newline | `backend/database/session_manager.py:28` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-052 | ruff I001 | `backend/database/sqlite_adapter.py:8` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-053 | pylint C0115 missing-class-docstring | `backend/database/sqlite_adapter.py:25` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-054 | pylint C0301 line-too-long | `backend/database/sqlite_adapter.py:33` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-055 | pylint C0301 line-too-long | `backend/database/sqlite_adapter.py:45` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-056 | pylint C0116 missing-function-docstring | `backend/database/sqlite_adapter.py:51` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-057 | pylint W0212 protected-access | `backend/database/sqlite_adapter.py:54` | Minor | Deferred to M3 | Singleton compares the requested path with the open one via a protected attribute of its own class. Safe, but a public read-only property would be cleaner. | | |
| SA-058 | pylint C0116 missing-function-docstring | `backend/database/sqlite_adapter.py:65` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-059 | pylint C0301 line-too-long | `backend/database/sqlite_adapter.py:96` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-060 | pylint C0301 line-too-long | `backend/database/sqlite_adapter.py:99` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-061 | pylint C0304 missing-final-newline | `backend/database/sqlite_adapter.py:109` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-062 | pylint C0115 missing-class-docstring | `backend/database/write_queue.py:14` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-063 | pylint C0301 line-too-long | `backend/database/write_queue.py:43` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-064 | pylint W0718 broad-exception-caught | `backend/database/write_queue.py:43` | Major | False positive (justified) | Deliberate catch: the exception is forwarded to the awaiting caller or logged by type only (no secrets); the loop must survive one failing job/hook. Reasoning is in the code comment. | | |
| SA-065 | ruff BLE001 | `backend/database/write_queue.py:43` | Major | False positive (justified) | Same deliberate catches as pylint W0718 (write_queue.py `_run`, main.py shutdown hooks); neither swallows silently. | | |
| SA-066 | pylint C0304 missing-final-newline | `backend/database/write_queue.py:50` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-067 | pylint C0304 missing-final-newline | `backend/errors.py:28` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-068 | pylint C0114 missing-module-docstring | `backend/main.py:1` | Minor | Deferred to M3 | Module docstring; add in M3. | | |
| SA-069 | ruff I001 | `backend/main.py:1` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-070 | pylint C0116 missing-function-docstring | `backend/main.py:26` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-071 | pylint W0613 unused-argument | `backend/main.py:34` | Minor | False positive | Parameter is required by the framework signature (FastAPI lifespan / exception handler) even though the body does not use it. | | |
| SA-072 | pylint W0718 broad-exception-caught | `backend/main.py:39` | Major | False positive (justified) | Deliberate catch: the exception is forwarded to the awaiting caller or logged by type only (no secrets); the loop must survive one failing job/hook. Reasoning is in the code comment. | | |
| SA-073 | ruff BLE001 | `backend/main.py:39` | Major | False positive (justified) | Same deliberate catches as pylint W0718 (write_queue.py `_run`, main.py shutdown hooks); neither swallows silently. | | |
| SA-074 | pylint C0304 missing-final-newline | `backend/main.py:57` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-075 | ruff I001 | `backend/server.py:5` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-076 | pylint C0116 missing-function-docstring | `backend/server.py:25` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-077 | pylint C0116 missing-function-docstring | `backend/server.py:36` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-078 | pylint C0304 missing-final-newline | `backend/server.py:52` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-079 | pylint R0903 too-few-public-methods | `backend/services/context_pruner.py:14` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-080 | pylint C0116 missing-function-docstring | `backend/services/context_pruner.py:28` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-081 | ruff I001 | `backend/services/gemini_adapter.py:6` | Minor | Fix | Import order; `ruff check --fix` sorts it with no behaviour change. | | |
| SA-082 | pylint C0115 missing-class-docstring | `backend/services/gemini_adapter.py:19` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-083 | pylint C0301 line-too-long | `backend/services/gemini_adapter.py:37` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-084 | pylint C0116 missing-function-docstring | `backend/services/gemini_adapter.py:53` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-085 | pylint C0304 missing-final-newline | `backend/services/gemini_adapter.py:65` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-086 | pylint C0301 line-too-long | `backend/services/llm_provider.py:1` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-087 | pylint C0115 missing-class-docstring | `backend/services/llm_provider.py:10` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-088 | pylint R0903 too-few-public-methods | `backend/services/llm_provider.py:10` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-089 | pylint C0304 missing-final-newline | `backend/services/llm_provider.py:13` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-090 | pylint C0304 missing-final-newline | `backend/services/models.py:26` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |
| SA-091 | pylint C0115 missing-class-docstring | `backend/services/prompt_factory.py:13` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-092 | pylint R0903 too-few-public-methods | `backend/services/prompt_factory.py:13` | Minor | False positive | Data/contract classes (schemas, dataclasses, Protocol-like adapters) are meant to have few public methods. | | |
| SA-093 | pylint C0116 missing-function-docstring | `backend/services/prompt_factory.py:15` | Minor | Deferred to M3 | Docstring on a method; add for public API methods in M3, private helpers are self-explanatory. | | |
| SA-094 | pylint C0115 missing-class-docstring | `backend/settings.py:20` | Minor | Deferred to M3 | Docstring on a class; add for the public classes in M3. | | |
| SA-095 | radon cc load_env_file V(G)=11 | `backend/settings.py:28` | Minor | Deferred to M3 | Complexity above 10: candidate for splitting parsing from validation. Config loader, not core business logic. | | |
| SA-096 | pylint C0301 line-too-long | `backend/settings.py:60` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-097 | pylint C0301 line-too-long | `backend/settings.py:67` | Minor | Deferred to M3 | No project line-length limit is configured (pylint default is 100). Set one limit in a shared config in M3 instead of reflowing code now. | | |
| SA-098 | pylint C0304 missing-final-newline | `backend/settings.py:75` | Minor | Fix | Mechanical: add the final newline (editor setting / ruff W292). | | |

| SA-099 | eslint complexity (limit 10) | `extension/background/extensionBridge.js:33` | Minor | Deferred to M3 | The constructor checks four options (complexity 15). Move the option checks into one helper; behaviour is covered by `extensionBridge.test.js`. Found on `ced879b` (new code from PR #50). | | |
| SA-100 | custom check `noRawFetch.test.js` | `extension/sidepanel/serverStatus.js`, `extension/sidepanel/sidepanel.js` | Minor | Fix (Ammar) | The panel calls `fetch` itself for its start-up health check instead of the bridge's `checkHealth`, against the rule that only the bridge talks to the backend (REQ-F02). The test lists both files as known exceptions and fails if an entry outlives its use. Fix is in `feature/panel-runtime-bridge` (red `13f5664`, green `73494f8`), not on `main` at `ced879b`. | CAPA-17 | pending |

Totals: 100 rows (some findings appear in both Pylint and Ruff, e.g. the blind `except`, and are counted once per tool). Fix: 30, false positive / justified: 17, deferred to M3: 53. Severity: 4 major (the deliberate broad `except` findings, justified), 96 minor.

## 4. Next steps

0. Corrections made on 2026-11-22: the first version of this file reported the Radon average over only the 6 blocks listed by `-nB` ("B, 7.3"); the average over all 77 blocks is A (2.32), which matches Nazaar's first pass. Ruff counts 16 here; Nazaar's first pass counted 15 with a different scope; this file states its exact command.
1. After the Fagan inspection: one `chore(lint)` commit with `ruff check --fix` for the Fix rows, plus a shared ruff/pylint config (line length, `fastapi.Depends`), then re-run all commands and fill in the "after" column of section 2.
2. Fill the CAPA link and fix commit columns for each row once the fix lands.
3. Optional: connect SonarCloud (free on public repos) for a dashboard screenshot.
