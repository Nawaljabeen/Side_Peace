/**
 * DOMObserver - the Subject of the Observer pattern (REQ-F01).
 *
 * It reads the Gemini chat page, works out which turns are new or changed and
 * tells every subscriber about each one. It knows only "a callback", never who
 * is listening (the ExtensionBridge subscribes later), so there is no dependency
 * on the bridge (DIP). It only reads the page, it never edits it.
 */
import { parseTurns } from "./turnParser.js";
import { GEMINI_SELECTORS } from "./selectors.js";

export class DOMObserver {
  #root;
  #selectors;
  #subscribers = new Set();
  #lastTextByIndex = new Map();

  /**
   * @param {ParentNode} root  element that contains the whole chat
   * @param {{selectors?: object}} [options]
   */
  constructor(root, { selectors = GEMINI_SELECTORS } = {}) {
    if (!root || typeof root.querySelectorAll !== "function") {
      throw new TypeError("DOMObserver: root must be a DOM node");
    }
    this.#root = root;
    this.#selectors = selectors;
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

  /** The newest turn on the page, or null when there is none. */
  parseLatestTurn() {
    const turns = parseTurns(this.#root, this.#selectors);
    return turns.length > 0 ? turns[turns.length - 1] : null;
  }

  /** Read the page and notify subscribers about every turn that is new or changed. */
  scan() {
    for (const turn of parseTurns(this.#root, this.#selectors)) {
      if (this.#lastTextByIndex.get(turn.index) === turn.text) {
        continue;
      }
      this.#lastTextByIndex.set(turn.index, turn.text);
      this.#notify(turn);
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
