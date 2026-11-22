/**
 * TurnRelay - a concrete Observer of the DOMObserver (REQ-F01, REQ-F02).
 *
 * It subscribes to the DOMObserver and sends every finished turn to the service worker as a
 * `sync-turn` message, which the ExtensionBridge turns into POST /sync. It only knows "a function that
 * sends a message" and "a function that gives the chat path", so it needs no chrome object (DIP).
 *
 * - Turns go out one at a time, in the order they arrived, so the backend never sees turn 3 before turn 2.
 * - Nothing that goes wrong here may reach the Gemini page (REQ-Q01): failures are logged and dropped.
 *   The log never contains chat text.
 * - Gemini is a single-page app and moves a new chat to its own address after the first answer. When the
 *   path changes, the observer is reset and the page is scanned again, so the whole chat is sent under the
 *   new path. /sync is idempotent, so the repeated turns are harmless.
 */
export class TurnRelay {
  #observer;
  #sendMessage;
  #getPath;
  #unsubscribe = null;
  #lastPath = null;
  #tail = Promise.resolve();

  /**
   * @param {object} dependencies
   * @param {{subscribe: Function, reset: Function, scan: Function}} dependencies.observer  the DOMObserver
   * @param {(message: object) => Promise<object>} dependencies.sendMessage  e.g. chrome.runtime.sendMessage
   * @param {() => string} dependencies.getPath  path of the chat currently shown, e.g. () => location.pathname
   */
  constructor({ observer, sendMessage, getPath } = {}) {
    if (!observer || typeof observer.subscribe !== "function") {
      throw new TypeError("TurnRelay: observer must be a DOMObserver");
    }
    if (typeof sendMessage !== "function" || typeof getPath !== "function") {
      throw new TypeError("TurnRelay: sendMessage and getPath must be functions");
    }
    this.#observer = observer;
    this.#sendMessage = sendMessage;
    this.#getPath = getPath;
  }

  /** Start listening. Calling it twice is safe. */
  start() {
    if (this.#unsubscribe !== null) {
      return;
    }
    this.#lastPath = this.#getPath();
    this.#unsubscribe = this.#observer.subscribe((turn) => this.#onTurn(turn));
  }

  /** Stop listening. Messages that were already queued are still delivered. */
  stop() {
    if (this.#unsubscribe === null) {
      return;
    }
    this.#unsubscribe();
    this.#unsubscribe = null;
  }

  /**
   * Call when the page may have moved to another chat. If the path really changed, the whole chat is
   * reported again under the new path.
   * @returns {boolean} true if the path had changed
   */
  checkPath() {
    const path = this.#getPath();
    if (path === this.#lastPath) {
      return false;
    }
    this.#lastPath = path;
    this.#observer.reset();
    try {
      this.#observer.scan();
    } catch (error) {
      console.error("SidePeace TurnRelay: scan after a chat change failed", error?.name);
    }
    return true;
  }

  #onTurn(turn) {
    const path = this.#getPath();
    this.#enqueue({ type: "sync-turn", conversationPath: path, turn });
    if (path !== this.#lastPath) {
      // Not inside the observer's notify loop: reset() and scan() must not run while it is notifying.
      queueMicrotask(() => this.checkPath());
    }
  }

  #enqueue(message) {
    this.#tail = this.#tail.then(() => this.#deliver(message));
  }

  /** Never rejects, so one failure cannot block the turns behind it. */
  async #deliver(message) {
    try {
      const reply = await this.#sendMessage(message);
      if (reply && reply.ok === false) {
        console.warn("SidePeace: a turn was not synced:", reply.error?.name ?? "unknown error");
      }
    } catch (error) {
      console.warn("SidePeace: a turn was not synced:", error?.name ?? "unknown error");
    }
  }
}
