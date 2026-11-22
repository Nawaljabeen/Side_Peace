// REQ-F01, REQ-F02: the content-script side of the bridge. TurnRelay is an Observer: it subscribes to the
// DOMObserver and sends every finished turn to the service worker. Fake observer and fake sendMessage only.
import { describe, it, expect, vi } from "vitest";
import { TurnRelay } from "../content/turnRelay.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const turn = (index, text = `t${index}`) => ({ index, role: index % 2 === 0 ? "user" : "model", text });

function fakeObserver() {
  const listeners = new Set();
  return {
    subscribe: vi.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    reset: vi.fn(),
    scan: vi.fn(),
    emit: (t) => [...listeners].forEach((listener) => listener(t)),
    count: () => listeners.size,
  };
}

function setup({ sendMessage = vi.fn().mockResolvedValue({ ok: true, turnCount: 1 }), path = "/app/abc" } = {}) {
  const observer = fakeObserver();
  const state = { path };
  const relay = new TurnRelay({ observer, sendMessage, getPath: () => state.path });
  return { observer, sendMessage, relay, state };
}

describe("TurnRelay: sending turns", () => {
  it("sends a sync-turn message with the turn and the chat path", async () => {
    const { observer, sendMessage, relay } = setup();
    relay.start();

    observer.emit(turn(0, "hello"));
    await flush();

    expect(sendMessage).toHaveBeenCalledWith({
      type: "sync-turn",
      conversationPath: "/app/abc",
      turn: { index: 0, role: "user", text: "hello" },
    });
  });

  it("sends one message at a time, in the order the turns arrived", async () => {
    const order = [];
    let release;
    const sendMessage = vi.fn((message) => {
      order.push(`start ${message.turn.index}`);
      return new Promise((resolve) => {
        const finish = () => {
          order.push(`end ${message.turn.index}`);
          resolve({ ok: true });
        };
        if (message.turn.index === 0) release = finish;
        else finish();
      });
    });
    const { observer, relay } = setup({ sendMessage });
    relay.start();

    observer.emit(turn(0));
    observer.emit(turn(1));
    await flush();
    expect(order).toEqual(["start 0"]);
    release();
    await flush();

    expect(order).toEqual(["start 0", "end 0", "start 1", "end 1"]);
  });

  it("subscribes once, even if start() is called twice", () => {
    const { observer, relay } = setup();

    relay.start();
    relay.start();

    expect(observer.count()).toBe(1);
  });

  it("stops sending after stop()", async () => {
    const { observer, sendMessage, relay } = setup();
    relay.start();

    relay.stop();
    observer.emit(turn(0));
    await flush();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(observer.count()).toBe(0);
  });
});

describe("TurnRelay: failures never reach the page (REQ-Q01)", () => {
  it.each([
    ["the service worker answers ok:false", () => vi.fn().mockResolvedValue({ ok: false, error: { name: "NetworkError" } })],
    ["sendMessage rejects (extension reloaded)", () => vi.fn().mockRejectedValue(new Error("Extension context invalidated."))],
    ["sendMessage throws at once", () => vi.fn(() => { throw new Error("boom"); })],
  ])("keeps going when %s", async (_name, makeSend) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sendMessage = makeSend();
    const { observer, relay } = setup({ sendMessage });
    relay.start();

    observer.emit(turn(0));
    observer.emit(turn(1));
    await flush();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does not print the turn text when it logs a failure (the chat is private)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { observer, relay } = setup({ sendMessage: vi.fn().mockRejectedValue(new Error("down")) });
    relay.start();

    observer.emit(turn(0, "my secret question"));
    await flush();

    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    warn.mockRestore();
  });
});

describe("TurnRelay: the chat changes (Gemini is a single-page app)", () => {
  it("resets the observer and scans again when the path changes", () => {
    const { observer, relay, state } = setup({ path: "/app" });
    relay.start();

    state.path = "/app/abc123";
    const changed = relay.checkPath();

    expect(changed).toBe(true);
    expect(observer.reset).toHaveBeenCalledTimes(1);
    expect(observer.scan).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the path is the same", () => {
    const { observer, relay } = setup();
    relay.start();

    expect(relay.checkPath()).toBe(false);
    expect(observer.reset).not.toHaveBeenCalled();
  });

  it("sends a turn that arrives after a path change under the new path and re-sends the chat", async () => {
    const { observer, sendMessage, relay, state } = setup({ path: "/app" });
    relay.start();

    state.path = "/app/abc123"; // Gemini moves a new chat to its own address after the first answer
    observer.emit(turn(1));
    await flush();

    expect(sendMessage.mock.calls[0][0].conversationPath).toBe("/app/abc123");
    expect(observer.reset).toHaveBeenCalledTimes(1);
    expect(observer.scan).toHaveBeenCalledTimes(1);
  });

  it("does not let a failing scan escape from checkPath", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { observer, relay, state } = setup({ path: "/app" });
    observer.scan.mockImplementation(() => { throw new Error("dom gone"); });
    relay.start();

    state.path = "/app/x";

    expect(() => relay.checkPath()).not.toThrow();
    error.mockRestore();
  });
});

describe("TurnRelay: construction", () => {
  it("rejects missing collaborators with a TypeError", () => {
    expect(() => new TurnRelay({})).toThrow(TypeError);
    expect(() => new TurnRelay({ observer: fakeObserver(), sendMessage: 1, getPath: () => "/" })).toThrow(TypeError);
  });
});
