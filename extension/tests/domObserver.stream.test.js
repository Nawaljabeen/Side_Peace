// REQ-F01 / QR-01: while Gemini streams an answer the page changes many times.
// DOMObserver must wait for the text to settle and then notify exactly once.
// Fake timers keep the test fast and independent of machine speed.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DOMObserver } from "../content/domObserver.js";

const SKELETON = `
  <main>
    <user-query><p class="query-text-line">Hi</p></user-query>
    <model-response><message-content><div class="markdown" id="answer"></div></message-content></model-response>
  </main>`;

describe("DOMObserver streaming", () => {
  let root;
  let answer;
  let observer;
  let listener;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = SKELETON;
    root = document.querySelector("main");
    answer = document.getElementById("answer");
    observer = new DOMObserver(root, { debounceMs: 50 });
    listener = vi.fn();
    observer.subscribe(listener);
  });

  afterEach(() => {
    observer.stopObserving();
    vi.useRealTimers();
  });

  it("syncs what is already on the page as soon as it starts observing", () => {
    observer.startObserving();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ index: 0, role: "user", text: "Hi" });
  });

  it("notifies once with the final text after the stream settles", async () => {
    observer.startObserving();
    listener.mockClear();

    for (const chunk of ["He", "Hello", "Hello wor", "Hello world"]) {
      answer.textContent = chunk;
      await vi.advanceTimersByTimeAsync(10); // chunks arrive faster than the 50 ms wait
    }
    expect(listener).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ index: 1, role: "model", text: "Hello world" });
  });

  it("coalesces 1000 mutation events into a single notification", async () => {
    let trigger;
    const createMutationObserver = (callback) => {
      trigger = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    };
    observer = new DOMObserver(root, { debounceMs: 50, createMutationObserver });
    observer.subscribe(listener);
    observer.startObserving();
    listener.mockClear();

    answer.textContent = "Final answer";
    for (let i = 0; i < 1000; i += 1) {
      trigger([]);
    }
    await vi.advanceTimersByTimeAsync(50);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].text).toBe("Final answer");
  });

  it("does not double-notify when startObserving is called twice", () => {
    observer.startObserving();
    observer.startObserving();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(observer.isObserving).toBe(true);
  });

  it("stops notifying after stopObserving", async () => {
    observer.startObserving();
    listener.mockClear();

    observer.stopObserving();
    answer.textContent = "late";
    await vi.advanceTimersByTimeAsync(100);

    expect(listener).not.toHaveBeenCalled();
    expect(observer.isObserving).toBe(false);
  });

  it("drops a notification that was still waiting when observing stopped", async () => {
    observer.startObserving();
    listener.mockClear();

    answer.textContent = "half way";
    await vi.advanceTimersByTimeAsync(10);
    observer.stopObserving();
    await vi.advanceTimersByTimeAsync(100);

    expect(listener).not.toHaveBeenCalled();
  });
});
