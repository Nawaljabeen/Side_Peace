
# Side_Peace

Side Peace is a real time Chrome companion that acts as a quiet memory keeper for your active AI sessions. It intercepts your side questions in a dedicated panel so you can debug, explore, and learn without disturbing the peace of your primary chat's context window.

**Team:** Nawal Jabeen · Nazaar Khalid · Ammar Zahid 

## Repository layout

```
Side_Peace/
├── backend/                 Python FastAPI server
│   ├── main.py              create_app() factory + app for uvicorn
│   ├── api/                 HTTP routers (/health, later /sync, /query)
│   ├── database/            State & Storage Manager (SQLiteAdapter, WriteQueue, SessionManager)   [Wave 1]
│   ├── services/            LLM providers (AbstractLLMProvider, GeminiAdapter), ContextPruner, PromptFactory [Wave 1–2]
│   └── tests/               pytest suite
├── extension/               Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content/             DOM Extraction Engine (DOMObserver, TextDebouncer) — runs on Gemini only
│   ├── background/          Service worker + ExtensionBridge (all HTTP calls to the backend)
│   ├── sidepanel/           Side Panel UI controller
│   └── tests/               Vitest + jsdom suite
├── docs/                    Design docs, API contract, thread-safety strategy        [added in Wave 0 step 4]
└── .github/workflows/       CI (GitHub Actions)
```

Folders marked with a wave are created when their first file is committed .

## Prerequisites

- Python **3.12+**
- Node.js **22.22+** (or 24 LTS) — required by Vitest 5 / jsdom
- Google Chrome

## Setup and tests

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest --cov                      # run tests with coverage
uvicorn main:app --reload         # serve on http://localhost:8000  (check /health)
```

### Extension

```bash
cd extension
npm ci                            # installs exact versions from package-lock.json
npm test                          # Vitest
npm run coverage                  # Vitest + coverage report (coverage/index.html)
npm run lint                      # ESLint
```

Load in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder → open https://gemini.google.com and click the SidePeace toolbar icon.

## Branching strategy and merge gates (GitHub Flow)

| Item | Rule |
|---|---|
| `main` | Always runnable and green. No direct pushes. |
| Branch names | `feature/<module>-<topic>`, `fix/<topic>`, `chore/<topic>`, `ci/<topic>`, `docs/<topic>`. Delete after merge. |
| Merge gates | Every merge into `main` needs: (1) a pull request, (2) ≥1 approval from a member other than the author, (3) CI green, (4) **merge commit only — squash and rebase merging are disabled** to preserve the red-green-refactor history. |
| Staying in sync | `git fetch && git merge origin/main` on your branch regularly; re-run tests. |
| Baselines | Each milestone's submitted build is tagged (`m2-baseline`, `m3-baseline`) and released on GitHub. |
| Issues | One issue per task, labelled by module, assigned to one person, referencing the REQ ID. PRs close issues (`Closes #n`). |

### Commit messages

`type(scope): summary` — types: `test`, `feat`, `fix`, `refactor`, `docs`, `chore`, `ci`. Scopes: `dom`, `bridge`, `panel`, `gateway`, `storage`, `pruner`, `manifest`, `backend`, `extension`.

TDD: the failing test is committed first (`test(scope): red - ...`), then the implementation (`feat(scope): green - ...`), then any cleanup (`refactor(scope): ...`). Pair-programmed commits end with `Co-authored-by: Name <email>`.

Never commit `.env`, API keys, `node_modules/`, virtual environments, coverage output or `*.db` files.