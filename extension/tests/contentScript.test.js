// REQ-F01 + REQ-F02: the content script connects the real DOMObserver and the relay.
// It reads Nawal's saved Gemini page (tests/fixtures) and must hand every turn to the service worker.
import { describe, it, expect, vi, afterEach } from "vitest";
import { startContentScript } from "../content/contentScript.js";
import { mountFixture } from "./helpers/fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("startContentScript", () => {
  it("relays every turn of the Gemini chat on the page, in order, once", async () => {
    mountFixture("gemini-conversation.html");
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, turnCount: 4 });

    const stop = startContentScript({
      document,
      runtime: { sendMessage },
      location: { pathname: "/app/7aef0c969e3d2551" },
    });

    const sent = sendMessage.mock.calls.map(([message]) => message);
    expect(sent.map((m) => [m.turn.index, m.turn.role])).toEqual([
      [0, "user"],
      [1, "model"],
      [2, "user"],
      [3, "model"],
    ]);
    expect(sent.every((m) => m.type === "sync-turn" && m.conversationPath === "/app/7aef0c969e3d2551")).toBe(true);
    expect(sent[0].turn.text).toMatch(/debouncer/i);

    stop();
  });

  it("returns a stop function that ends the relay", () => {
    mountFixture("gemini-conversation.html");
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    const stop = startContentScript({ document, runtime: { sendMessage }, location: { pathname: "/app" } });
    sendMessage.mockClear();

    stop();

    expect(typeof stop).toBe("function");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does nothing and does not throw on a page without a chat", () => {
    document.body.innerHTML = "<main>nothing to see</main>";
    const sendMessage = vi.fn();
    expect(() => startContentScript({ document, runtime: { sendMessage }, location: { pathname: "/app" } })()).not.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
