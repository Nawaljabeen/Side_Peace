import { BACKEND_URL, MAX_QUERY_LENGTH, MAX_TURN_TEXT_LENGTH, SESSION_ID_PATTERN } from "../shared/constants.js";
import { NetworkError, ServerError, ValidationError } from "../shared/errors.js";

export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_RETRY_DELAY_MS = 500;
export const SYNC_ATTEMPTS = 3; // the first try plus two retries

const ROLES = ["user", "model"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TOO_SLOW = "The SidePeace server took too long to answer.";
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
  #timeoutMs;
  #retryDelayMs;

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
    this.#timeoutMs = timeoutMs;
    this.#retryDelayMs = retryDelayMs;
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
    const body = await this.#postWithRetry("/sync", { session_id: sessionId, turn: { index, role, text } });
    if (body?.status !== "ok" || !Number.isInteger(body.turn_count) || body.turn_count < 0) {
      throw badResponse();
    }
    return body.turn_count;
  }

  // Only /sync is retried: DOMObserver reports a finished turn once, so a lost sync would never be sent again.
  // A side question is never retried (the user is waiting and it would cost a second model call).
  async #postWithRetry(path, payload) {
    let delay = this.#retryDelayMs;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.#post(path, payload);
      } catch (error) {
        if (attempt >= SYNC_ATTEMPTS || !isTemporary(error)) {
          throw error;
        }
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  async #post(path, payload) {
    const { response, body } = await this.#withTimeLimit((signal) => this.#exchange(path, payload, signal));
    if (response.ok) {
      return body;
    }
    throw errorForStatus(response.status, body);
  }

  // One time limit for the whole exchange (waiting for the response AND reading its body). When it passes the
  // request is aborted and the caller gets a NetworkError with timedOut set. The timer is always cleared, so
  // nothing is left running that would keep the service worker awake.
  async #withTimeLimit(work) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new NetworkError(TOO_SLOW, { timedOut: true }));
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([work(controller.signal), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #exchange(path, payload, signal) {
    try {
      const response = await this.#fetchFn(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
        signal,
      });
      return { response, body: await readJson(response) };
    } catch (cause) {
      if (cause?.name === "AbortError") {
        throw new NetworkError(TOO_SLOW, { timedOut: true, cause });
      }
      throw new NetworkError(UNREACHABLE, { cause });
    }
  }
}

// Worth another try when waiting might fix it: no connection, a timeout, a busy or broken server.
// A 422 or any other refusal is never retried because the same turn would be refused again.
function isTemporary(error) {
  if (error instanceof NetworkError) {
    return true;
  }
  return error instanceof ServerError && (error.status === 429 || error.status >= 500);
}

function badResponse() {
  return new ServerError(UNEXPECTED, { code: "bad_response" });
}

// The parsed JSON body, or undefined when the body is not valid JSON. Any other failure (for example a
// connection that drops half way through the body) is rethrown and becomes a NetworkError.
async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
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
