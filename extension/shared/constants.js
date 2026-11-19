// Single source for the query limit on the extension side. Must equal MAX_QUESTION_LENGTH
// in backend/services/prompt_factory.py and the contract in docs/api-contract.md.
export const MAX_QUERY_LENGTH = 2000;

// Local FastAPI gateway (host permission for it is declared in manifest.json).
export const BACKEND_URL = "http://localhost:8000";
