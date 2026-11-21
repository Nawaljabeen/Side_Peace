// ExtensionBridge: the ONLY code in the extension that talks to the backend (REQ-F02, REQ-Q02, DEC-09).
// It lives in the service worker. Everything else (content script, side panel) asks it through
// chrome.runtime messages, so there is no raw fetch anywhere else and no API key in the client.
import { NetworkError, ValidationError, ServerError } from "../shared/errors.js";

export const DEFAULT_BASE_URL = "http://localhost:8000";
export const DEFAULT_TIMEOUT_MS = 20000;

export class ExtensionBridge {
  #baseUrl;
  #fetchFn;
  #timeoutMs;
  #syncedTexts = new Map(); // "session|index" -> text that the backend already has
  #inFlight = new Map(); // "session|index|text" -> promise, so identical turns share one request

  /**
   * @param {object} options
   * @param {string} [options.baseUrl]   backend address (configurable, default http://localhost:8000)
   * @param {typeof fetch} [options.fetchFn]  injected in tests
   * @param {number} [options.timeoutMs]  a request that takes longer is aborted
   */
  constructor({ baseUrl = DEFAULT_BASE_URL, fetchFn = (...args) => fetch(...args), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#fetchFn = fetchFn;
    this.#timeoutMs = timeoutMs;
  }

  /** Ask a side question; resolves to the answer text. */
  async sendQuery(sessionId, text) {
    const body = await this.#postJson("/query", { session_id: sessionId, text });
    if (typeof body?.answer !== "string" || body.answer === "") {
      throw new ServerError("The server answered without any text.", { status: 200, code: "provider_bad_response" });
    }
    return body.answer;
  }

  /** Save one finished chat turn; sends each (session, index, text) exactly once. Resolves to the turn count. */
  async syncTurn(sessionId, turn) {
    const slot = `${sessionId}|${turn.index}`;
    if (this.#syncedTexts.get(slot) === turn.text) {
      return null; // already stored, nothing to send
    }
    const flightKey = `${slot}|${turn.text}`;
    if (this.#inFlight.has(flightKey)) {
      return this.#inFlight.get(flightKey);
    }
    const request = this.#postJson("/sync", {
      session_id: sessionId,
      turn: { index: turn.index, role: turn.role, text: turn.text },
    })
      .then((body) => {
        this.#syncedTexts.set(slot, turn.text);
        return body?.turn_count ?? null;
      })
      .finally(() => this.#inFlight.delete(flightKey));
    this.#inFlight.set(flightKey, request);
    return request;
  }

  /** True when the backend answers GET /health with status ok. Never throws. */
  async checkHealth() {
    try {
      const response = await this.#request("/health", { method: "GET" });
      if (!response.ok) {
        return false;
      }
      return (await response.json()).status === "ok";
    } catch {
      return false;
    }
  }

  async #postJson(path, payload) {
    const response = await this.#request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readJson(response);
    if (response.ok) {
      return body;
    }
    throw errorForStatus(response.status, body);
  }

  async #request(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetchFn(`${this.#baseUrl}${path}`, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new NetworkError("The server took too long to answer.", { timedOut: true });
      }
      throw new NetworkError("Could not reach the SidePeace server.");
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorForStatus(status, body) {
  const code = typeof body?.error === "string" ? body.error : undefined;
  const message = typeof body?.message === "string" ? body.message : `The server answered HTTP ${status}.`;
  if (status === 422) {
    return new ValidationError(message, { status, code });
  }
  return new ServerError(message, { status, code });
}
