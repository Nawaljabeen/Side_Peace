// REQ-F01, REQ-F02, REQ-Q02: the whole extension in one go, without a browser: the Gemini page (jsdom) ->
// content script -> chrome.runtime.sendMessage -> service worker -> ExtensionBridge -> fake backend (fake fetch).
// Verification test: it passes on first run because the parts already fit together.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startContent } from "../content/main.js";
import { setupServiceWorker } from "../background/serviceWorkerSetup.js";
import { ExtensionBridge } from "../background/extensionBridge.js";

const OWN_ID = "my-extension-id";
const BASE = "http://localhost:8000";
const TAB = { id: 7, url: "https://gemini.google.com/app/abc123" };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const user = (text) => `<user-query><p class="query-text-line">${text}</p></user-query>`;
const model = (text) => `<model-response><message-content><div class="markdown"><p>${text}</p></div></message-content></model-response>`;

function setup({ fetchFn, pathname = "/app/abc123" }) {
  // Service worker side, with the real listener, handler and bridge.
  const swChrome = {
    runtime: { id: OWN_ID, onMessage: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue([TAB]) },
    sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
  };
  setupServiceWorker(swChrome, { bridge: new ExtensionBridge({ baseUrl: BASE, fetchFn, retryDelayMs: 0 }) });
  const listener = swChrome.runtime.onMessage.addListener.mock.calls[0][0];
  const deliver = (message, sender) => new Promise((resolve) => listener(message, sender, resolve));

  // Content script side: sendMessage goes straight into the service worker's listener, like Chrome would do.
  const contentChrome = { runtime: { sendMessage: (message) => deliver(message, { id: OWN_ID, tab: { id: TAB.id } }) } };
  const listeners = {};
  const win = {
    location: { hostname: "gemini.google.com", pathname },
    navigation: { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: vi.fn() },
  };
  const stop = startContent({ document, window: win, chromeApi: contentChrome, debounceMs: 5 });
  return { win, stop, navigate: (path) => { win.location.pathname = path; listeners.navigatesuccess(); }, deliver };
}

const syncedTurns = (fetchFn) =>
  fetchFn.mock.calls
    .filter(([url]) => url.endsWith("/sync"))
    .map(([, options]) => JSON.parse(options.body))
    .map(({ session_id, turn }) => `${session_id}#${turn.index}:${turn.role}`);

let running;
beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => { running?.stop(); running = undefined; });

describe("Gemini page to backend", () => {
  it("syncs every turn of an open chat, in order, under the chat's session id", async () => {
    document.body.innerHTML = user("what is a mutex?") + model("A lock.");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok", turn_count: 1 }) });

    running = setup({ fetchFn });
    await wait(40);

    expect(syncedTurns(fetchFn)).toEqual(["g-abc123#0:user", "g-abc123#1:model"]);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).turn.text).toBe("what is a mutex?");
  });

  it("syncs an answer that streams in, once, after it has settled", async () => {
    document.body.innerHTML = user("hi");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok", turn_count: 1 }) });
    running = setup({ fetchFn });
    await wait(30);

    for (const text of ["He", "Hello", "Hello there"]) {
      document.body.innerHTML = user("hi") + model(text);
      await wait(2);
    }
    await wait(60);

    expect(syncedTurns(fetchFn)).toEqual(["g-abc123#0:user", "g-abc123#1:model"]);
    expect(JSON.parse(fetchFn.mock.calls.at(-1)[1].body).turn.text).toBe("Hello there");
  });

  it("sends a new chat again under its own address once Gemini moves it there", async () => {
    document.body.innerHTML = user("hello");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok", turn_count: 1 }) });
    running = setup({ fetchFn, pathname: "/app" });
    await wait(40);

    document.body.innerHTML = user("hello") + model("hi");
    running.navigate("/app/abc123");
    await wait(60);

    const synced = syncedTurns(fetchFn);
    expect(synced[0]).toBe("g-new-7#0:user");
    expect(synced).toContain("g-abc123#0:user");
    expect(synced).toContain("g-abc123#1:model");
  });

  it("answers a side question in the same session the turns were synced to", async () => {
    document.body.innerHTML = user("hi") + model("hello");
    const fetchFn = vi.fn().mockImplementation(async (url) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith("/query") ? { answer: "a lock" } : { status: "ok", turn_count: 2 }),
    }));
    running = setup({ fetchFn });
    await wait(40);

    const answer = await running.deliver({ type: "query", text: "what is a mutex?" }, { id: OWN_ID });

    expect(answer).toEqual({ ok: true, answer: "a lock" });
    const sessions = fetchFn.mock.calls.map(([, options]) => JSON.parse(options.body).session_id);
    expect(new Set(sessions)).toEqual(new Set(["g-abc123"]));
  });

  it("leaves the Gemini page untouched and quiet when the backend is down (REQ-F01, REQ-Q01)", async () => {
    document.body.innerHTML = user("hi") + model("hello");
    const before = document.body.innerHTML;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    running = setup({ fetchFn });
    await wait(80);

    expect(document.body.innerHTML).toBe(before);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
