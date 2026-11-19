
 
 // Single responsibility because it deals w  timing only. It knows nothing about the DOM 
 
export class TextDebouncer {
  #delayMs;
  #callback;
  #timerId = null;
  #pendingValue;

  /**
   * @param {number} delayMs  
   * @param {(value: unknown) => void} callback 
   */
  constructor(delayMs, callback) {
    if (typeof delayMs !== "number") {
      throw new TypeError("TextDebouncer: delayMs must be a number");
    }
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError("TextDebouncer: delayMs must be a finite number >= 0");
    }
    if (typeof callback !== "function") {
      throw new TypeError("TextDebouncer: callback must be a function");
    }
    this.#delayMs = delayMs;
    this.#callback = callback;
  }

 
  get isPending() {
    return this.#timerId !== null;
  }

 
  debounce(value) {
    this.#pendingValue = value;
    if (this.#timerId !== null) {
      clearTimeout(this.#timerId);
    }
    this.#timerId = setTimeout(() => this.#fire(), this.#delayMs);
  }

 
  flush() {
    if (this.#timerId === null) {
      return;
    }
    clearTimeout(this.#timerId);
    this.#fire();
  }

  
  cancel() {
    if (this.#timerId !== null) {
      clearTimeout(this.#timerId);
    }
    this.#timerId = null;
    this.#pendingValue = undefined;
  }

  #fire() {
    const value = this.#pendingValue;
    this.#timerId = null;
    this.#pendingValue = undefined;
    this.#callback(value);
  }
}