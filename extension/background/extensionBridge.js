import { BACKEND_URL, MAX_QUERY_LENGTH, MAX_TURN_TEXT_LENGTH, SESSION_ID_PATTERN } from "../shared/constants.js";
import { NetworkError, ServerError, ValidationError } from "../shared/errors.js";

export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_RETRY_DELAY_MS = 500;

const ROLES = ["user", "model"];
const UNREACHABLE = "Could not reach the SidePeace server. Is it running?";
const UNEXPECTED = "The SidePeace server returned an unexpected response.";

/**
 * The only code in the extension that talks to the SidePeace backend (REQ-F02, DEC-09).
 * It lives in the service worker; the content script and the side panel ask it through
 * chrome.runtime messages. It knows the contract (docs/api-contract.md) and nothing about
 * Gemini pages or the side panel (SRP). The session id is chosen by the caller.
 */
export class ExtensionBridge {
  #baseUrl;
  #fetchFn;

  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl]  backend address (configurable, default shared/constants.js)
   * @param {typeof fetch} [options.fetchFn]  injected in tests
   * @param {number} [options.timeoutMs]  a request that takes longer is aborted
   * @param {number} [options.retryDelayMs]  wait before the first retry of a failed sync (0 in tests)
   */
  constructor({
    baseUrl = BACKEND_URL,
    fetchFn = (...args) => globalThis.fetch(...args),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = {}) {
    if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
      throw new TypeError("baseUrl must be a non-empty string");
    }
    if (typeof fetchFn !== "function") {
      throw new TypeError("fetchFn must be a function");
    }
    if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive finite number");
    }
    if (typeof retryDelayMs !== "number" || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
      throw new RangeError("retryDelayMs must be a finite number of 0 or more");
    }
    this.#baseUrl = baseUrl.trim().replace(/\/+$/, "");
    this.#fetchFn = fetchFn;
  }

  /** Ask a side question (POST /query). Resolves to the answer text. */
  async sendQuery(sessionId, text) {
    assertValidSessionId(sessionId);
    assertValidQuery(text);
    const body = await this.#post("/query", { session_id: sessionId, text });
    if (typeof body?.answer !== "string" || body.answer.trim() === "") {
      throw badResponse();
    }
    return body.answer;
  }

  /** Save one finished chat turn (POST /sync). Resolves to the number of turns the backend now holds. */
  async syncTurn(sessionId, turn) {
    assertValidSessionId(sessionId);
    assertValidTurn(turn);
    const { index, role, text } = turn;
    const body = await this.#post("/sync", { session_id: sessionId, turn: { index, role, text } });
    if (body?.status !== "ok" || !Number.isInteger(body.turn_count) || body.turn_count < 0) {
      throw badResponse();
    }
    return body.turn_count;
  }

  async #post(path, payload) {
    let response;
    try {
      response = await this.#fetchFn(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
      });
    } catch (cause) {
      throw new NetworkError(UNREACHABLE, { cause });
    }
    const body = await readJson(response);
    if (response.ok) {
      return body;
    }
    throw errorForStatus(response.status, body);
  }
}

function badResponse() {
  return new ServerError(UNEXPECTED, { code: "bad_response" });
}

// The parsed JSON body, or undefined when the body is missing or is not JSON.
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

// docs/api-contract.md: every error body is {error, message}; 422 is a validation problem, the rest are server errors.
function errorForStatus(status, body) {
  const code = typeof body?.error === "string" ? body.error : undefined;
  const message = typeof body?.message === "string" && body.message !== "" ? body.message : `${UNEXPECTED} (HTTP ${status})`;
  if (status === 422) {
    return new ValidationError(message, { code });
  }
  return new ServerError(message, { status, code });
}

function assertValidSessionId(sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new ValidationError("The session id must be 1-64 characters: letters, digits, _ or -.");
  }
}

function assertValidQuery(text) {
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`A question needs 1-${MAX_QUERY_LENGTH} characters of text.`);
  }
}

function assertValidTurn(turn) {
  const valid =
    turn !== null &&
    typeof turn === "object" &&
    Number.isInteger(turn.index) &&
    turn.index >= 0 &&
    ROLES.includes(turn.role) &&
    typeof turn.text === "string" &&
    turn.text.length >= 1 &&
    turn.text.length <= MAX_TURN_TEXT_LENGTH;
  if (!valid) {
    throw new ValidationError(`A turn needs an index of 0 or more, a role (user or model) and 1-${MAX_TURN_TEXT_LENGTH} characters of text.`);
  }
}
