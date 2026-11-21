import { BACKEND_URL } from "../shared/constants.js";

export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_RETRY_DELAY_MS = 500;

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
    const body = await this.#post("/query", { session_id: sessionId, text });
    return body.answer;
  }

  /** Save one finished chat turn (POST /sync). Resolves to the number of turns the backend now holds. */
  async syncTurn(sessionId, turn) {
    const { index, role, text } = turn;
    const body = await this.#post("/sync", { session_id: sessionId, turn: { index, role, text } });
    return body.turn_count;
  }

  async #post(path, payload) {
    const response = await this.#fetchFn(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    });
    return response.json();
  }
}
