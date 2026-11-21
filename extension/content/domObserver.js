/**
 * DOMObserver - the Subject of the Observer pattern (REQ-F01).
 *
 * It watches the Gemini chat page, waits until the streamed text settles
 * (TextDebouncer), works out which turns are new or changed and tells every
 * subscriber about each one. It knows only "a callback", never who is listening
 * (the ExtensionBridge subscribes later), so there is no dependency on the
 * bridge (DIP). It only reads the page, it never edits it.
 */
import { TextDebouncer } from "./textDebouncer.js";
import { parseTurns } from "./turnParser.js";
import { GEMINI_SELECTORS } from "./selectors.js";

const OBSERVE_OPTIONS = Object.freeze({ childList: true, subtree: true, characterData: true });

export class DOMObserver {
  #root;
  #selectors;
  #createMutationObserver;
  #debouncer;
  #mutationObserver = null;
  #subscribers = new Set();
  #lastTextByIndex = new Map();

  /**
   * @param {ParentNode} root  element that contains the whole chat
   * @param {object} [options]
   * @param {number} [options.debounceMs=300]  quiet time before a streamed turn counts as finished
   * @param {object} [options.selectors]       Gemini selectors (default: selectors.js)
   * @param {(callback: Function) => MutationObserver} [options.createMutationObserver]
   *        factory for the browser's MutationObserver; tests pass a fake (DIP)
   */
  constructor(
    root,
    {
      debounceMs = 300,
      selectors = GEMINI_SELECTORS,
      createMutationObserver = (callback) => new MutationObserver(callback),
    } = {},
  ) {
    if (!root || typeof root.querySelectorAll !== "function") {
      throw new TypeError("DOMObserver: root must be a DOM node");
    }
    this.#root = root;
    this.#selectors = selectors;
    this.#createMutationObserver = createMutationObserver;
    this.#debouncer = new TextDebouncer(debounceMs, () => this.#scanSafely());
  }

  /** True between startObserving() and stopObserving(). */
  get isObserving() {
    return this.#mutationObserver !== null;
  }

  /**
   * Register a listener that receives each new or changed turn.
   * @param {(turn: {index: number, role: string, text: string}) => void} listener
   * @returns {() => void} call it to unsubscribe
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("DOMObserver: subscriber must be a function");
    }
    this.#subscribers.add(listener);
    return () => {
      this.#subscribers.delete(listener);
    };
  }

  /**
   * Start watching the page. Turns already on the page are reported straight away,
   * later changes are reported once the text has settled. Calling it twice is safe.
   */
  startObserving() {
    if (this.#mutationObserver !== null) {
      return;
    }
    // The handler only restarts a timer, so it is far below the 50 ms budget (QR-01).
    this.#mutationObserver = this.#createMutationObserver(() => this.#debouncer.debounce());
    this.#mutationObserver.observe(this.#root, OBSERVE_OPTIONS);
    this.#scanSafely();
  }

  /** Stop watching and drop any notification that was still waiting. */
  stopObserving() {
    if (this.#mutationObserver === null) {
      return;
    }
    this.#mutationObserver.disconnect();
    this.#mutationObserver = null;
    this.#debouncer.cancel();
  }

  /** The newest turn on the page, or null when there is none. */
  parseLatestTurn() {
    const turns = parseTurns(this.#root, this.#selectors);
    return turns.length > 0 ? turns[turns.length - 1] : null;
  }

  /** Forget what was already reported, so the next scan reports every turn again. */
  reset() {
    this.#lastTextByIndex.clear();
  }

  /** Read the page and notify subscribers about every turn that is new or changed. */
  scan() {
    const turns = parseTurns(this.#root, this.#selectors);
    if (this.#isDifferentConversation(turns)) {
      this.reset();
    }
    for (const turn of turns) {
      if (this.#lastTextByIndex.get(turn.index) === turn.text) {
        continue;
      }
      this.#lastTextByIndex.set(turn.index, turn.text);
      this.#notify(turn);
    }
  }

  /**
   * Streaming only ever adds turns or changes the newest one. If the page now has fewer turns, or an
   * earlier turn has different text, the user moved to another chat (Gemini is a single-page app).
   */
  #isDifferentConversation(turns) {
    if (this.#lastTextByIndex.size === 0 || turns.length === 0) {
      return false;
    }
    const lastKnownIndex = Math.max(...this.#lastTextByIndex.keys());
    if (turns[turns.length - 1].index < lastKnownIndex) {
      return true;
    }
    return turns.some((turn) => turn.index < lastKnownIndex && this.#lastTextByIndex.get(turn.index) !== turn.text);
  }

  /** scan() for timer/startup paths, where nobody can catch an exception. */
  #scanSafely() {
    try {
      this.scan();
    } catch (error) {
      console.error("SidePeace DOMObserver: scan failed", error);
    }
  }

  #notify(turn) {
    for (const listener of [...this.#subscribers]) {
      try {
        listener(turn);
      } catch (error) {
        // One broken subscriber must not stop the others (Observer isolation).
        console.error("SidePeace DOMObserver: a subscriber failed", error);
      }
    }
  }
}
