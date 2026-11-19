// Single source for the query limit on the extension side. Must equal MAX_QUESTION_LENGTH
// in backend/services/prompt_factory.py and the contract in docs/api-contract.md.
export const MAX_QUERY_LENGTH = 2000;

// Local FastAPI gateway (host permission for it is declared in manifest.json).
export const BACKEND_URL = "http://localhost:8000";


// Longest turn text the backend accepts on /sync. Must equal turn.text max in docs/api-contract.md
// (Turn.MAX_TURN_TEXT_LENGTH on the backend). The DOM engine truncates to this before syncing.
export const MAX_TURN_TEXT_LENGTH = 20000;
