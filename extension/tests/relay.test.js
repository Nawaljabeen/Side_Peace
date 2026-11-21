// REQ-F01 + REQ-F02: the content script relays every finished turn that DOMObserver reports to the service
// worker (which owns the only connection to the backend), and re-sends a chat when Gemini moves to another one.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startRelay } from "../content/relay.js";

function fakeObserver() {
  const subscribers = new Set();
  return {
    subscribe: vi.fn((listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    }),
    reset: vi.fn(),
    scan: vi.fn(),
    emit: (turn) => subscribers.forEach((listener) => listener(turn)),
    subscriberCount: () => subscribers.size,
  };
}

describe("startRelay", () => {
  let observer;
  let sendMessage;
  let path;

  beforeEach(() => {
    vi.useFakeTimers();
    observer = fakeObserver();
    sendMessage = vi.fn().mockResolvedValue({ ok: true, turnCount: 1 });
    path = "/app";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const start = () => startRelay({ observer, sendMessage, getPathname: () => path, pollMs: 1000 });

  it("sends every reported turn to the service worker with the chat it belongs to", () => {
    start();
    path = "/app/abc123";
    observer.emit({ index: 0, role: "user", text: "hello" });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "sync-turn",
      conversationPath: "/app/abc123",
      turn: { index: 0, role: "user", text: "hello" },
    });
  });

  it("does not throw when sending fails or the worker refuses the turn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    start();

    sendMessage.mockRejectedValueOnce(new Error("Extension context invalidated."));
    observer.emit({ index: 0, role: "user", text: "a" });
    sendMessage.mockResolvedValueOnce({ ok: false, error: { name: "NetworkError", message: "offline" } });
    observer.emit({ index: 1, role: "model", text: "b" });

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  });

  it("re-sends the whole chat when the address moves to another chat", () => {
    start();
    vi.advanceTimersByTime(3000);
    expect(observer.reset).not.toHaveBeenCalled(); // same page: nothing to do

    path = "/app/new-chat-id";
    vi.advanceTimersByTime(1000);

    expect(observer.reset).toHaveBeenCalledTimes(1);
    expect(observer.scan).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(observer.reset).toHaveBeenCalledTimes(1); // only once per change
  });

  it("stop() unsubscribes and stops watching the address", () => {
    const stop = start();
    stop();
    expect(observer.subscriberCount()).toBe(0);

    path = "/app/other";
    vi.advanceTimersByTime(5000);
    expect(observer.reset).not.toHaveBeenCalled();
  });
});
