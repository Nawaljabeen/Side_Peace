// REQ-F02, REQ-Q02: the whole service-worker side in one go: a chrome.runtime message goes through the real
// listener, handler and ExtensionBridge to a fake backend (fake fetch), and the reply is what the content script
// or side panel would receive. Verification test: it passes on first run because the parts already fit together.
import { describe, it, expect, vi } from "vitest";
import { setupServiceWorker } from "../background/serviceWorkerSetup.js";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { NetworkError, ServerError, fromErrorPayload } from "../shared/errors.js";

const OWN_ID = "my-extension-id";
const BASE = "http://localhost:8000";
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function start(fetchFn, tabs = [{ id: 7, url: "https://gemini.google.com/app/abc123" }]) {
  const chromeApi = {
    runtime: { id: OWN_ID, onMessage: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue(tabs) },
    sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
  };
  setupServiceWorker(chromeApi, { bridge: new ExtensionBridge({ baseUrl: BASE, fetchFn, retryDelayMs: 0 }) });
  const listener = chromeApi.runtime.onMessage.addListener.mock.calls[0][0];
  // Sends one message the way Chrome would and resolves to what the sender receives.
  return (message, sender) => new Promise((resolve) => listener(message, sender, resolve));
}
const contentScript = { id: OWN_ID, tab: { id: 7 } };
const sidePanel = { id: OWN_ID };
const turn = { index: 0, role: "user", text: "hello" };

describe("service worker, end to end with a fake backend", () => {
  it("a finished turn from the content script reaches POST /sync with the chat's session id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "ok", turn_count: 1 }));
    const send = start(fetchFn);

    const answer = await send({ type: "sync-turn", conversationPath: "/app/abc123", turn }, contentScript);

    expect(answer).toEqual({ ok: true, turnCount: 1 });
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/sync`);
    expect(JSON.parse(options.body)).toEqual({ session_id: "g-abc123", turn });
  });

  it("a side question reaches POST /query in the session of the active chat and returns the answer", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { answer: "a lock" }));
    const send = start(fetchFn);

    const answer = await send({ type: "query", text: "what is a mutex?" }, sidePanel);

    expect(answer).toEqual({ ok: true, answer: "a lock" });
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ session_id: "g-abc123", text: "what is a mutex?" });
  });

  it("turns synced from a new-chat tab and a question asked there share one session", async () => {
    const fetchFn = vi.fn().mockImplementation(async (url) =>
      url.endsWith("/sync") ? reply(200, { status: "ok", turn_count: 1 }) : reply(200, { answer: "a" }),
    );
    const send = start(fetchFn, [{ id: 7, url: "https://gemini.google.com/app" }]);

    await send({ type: "sync-turn", conversationPath: "/app", turn }, contentScript);
    await send({ type: "query", text: "hi" }, sidePanel);

    const sessions = fetchFn.mock.calls.map(([, options]) => JSON.parse(options.body).session_id);
    expect(sessions).toEqual(["g-new-7", "g-new-7"]);
  });

  it("a sync that fails once is retried and the content script still gets a success", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(reply(200, { status: "ok", turn_count: 1 }));
    const send = start(fetchFn);

    expect(await send({ type: "sync-turn", conversationPath: "/app/abc123", turn }, contentScript)).toEqual({
      ok: true,
      turnCount: 1,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("a backend that is down becomes a NetworkError the side panel can rebuild", async () => {
    const send = start(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const answer = await send({ type: "query", text: "hi" }, sidePanel);

    expect(answer.ok).toBe(false);
    expect(fromErrorPayload(JSON.parse(JSON.stringify(answer.error)))).toBeInstanceOf(NetworkError);
  });

  it("a provider timeout (504) becomes a ServerError with its code", async () => {
    const send = start(vi.fn().mockResolvedValue(reply(504, { error: "provider_timeout", message: "Too slow." })));

    const answer = await send({ type: "query", text: "hi" }, sidePanel);
    const error = fromErrorPayload(answer.error);

    expect(error).toBeInstanceOf(ServerError);
    expect([error.status, error.code, error.message]).toEqual([504, "provider_timeout", "Too slow."]);
  });

  it("health reports whether the backend is up", async () => {
    const up = start(vi.fn().mockResolvedValue(reply(200, { status: "ok" })));
    const down = start(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    expect(await up({ type: "health" }, sidePanel)).toEqual({ ok: true, healthy: true });
    expect(await down({ type: "health" }, sidePanel)).toEqual({ ok: true, healthy: false });
  });

  it("a message from another extension never reaches the backend", async () => {
    const fetchFn = vi.fn();
    const send = start(fetchFn);

    const answer = await send({ type: "query", text: "hi" }, { id: "someone-else" });

    expect(answer.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
