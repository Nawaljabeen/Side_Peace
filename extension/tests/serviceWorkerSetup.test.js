// REQ-F02, R-05: Chrome stops an idle service worker and starts it again when a message arrives, so the message
// listener must be registered at once, when the worker's code first runs, before anything asynchronous.
// Fake chrome and a fake bridge only: no browser, no network.
import { describe, it, expect, vi } from "vitest";
import { registerMessageListener, setupServiceWorker } from "../background/serviceWorkerSetup.js";

const OWN_ID = "my-extension-id";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeChrome({ setPanelBehavior = vi.fn().mockResolvedValue(undefined), tabs = [] } = {}) {
  return {
    runtime: { id: OWN_ID, onMessage: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue(tabs) },
    sidePanel: { setPanelBehavior },
  };
}
const fakeBridge = () => ({
  syncTurn: vi.fn().mockResolvedValue(1),
  sendQuery: vi.fn().mockResolvedValue("an answer"),
  checkHealth: vi.fn().mockResolvedValue(true),
});

describe("registerMessageListener", () => {
  it("adds exactly one chrome.runtime.onMessage listener", () => {
    const chromeApi = fakeChrome();

    registerMessageListener(chromeApi, vi.fn());

    expect(chromeApi.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it("answers through sendResponse and returns true so the message channel stays open", async () => {
    const chromeApi = fakeChrome();
    const handler = vi.fn().mockResolvedValue({ ok: true, answer: "hi" });
    registerMessageListener(chromeApi, handler);
    const listener = chromeApi.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    const keepOpen = listener({ type: "query" }, { id: OWN_ID }, sendResponse);
    await flush();

    expect(keepOpen).toBe(true);
    expect(handler).toHaveBeenCalledWith({ type: "query" }, { id: OWN_ID });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, answer: "hi" });
  });

  it("answers with a safe error object if the handler ever fails (it should not)", async () => {
    const chromeApi = fakeChrome();
    registerMessageListener(chromeApi, vi.fn().mockRejectedValue(new Error("C:\\secret")));
    const listener = chromeApi.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn();

    listener({}, {}, sendResponse);
    await flush();

    const reply = sendResponse.mock.calls[0][0];
    expect(reply.ok).toBe(false);
    expect(JSON.stringify(reply)).not.toContain("secret");
  });

  it("does not crash when the sender has gone away and sendResponse throws", async () => {
    const chromeApi = fakeChrome();
    registerMessageListener(chromeApi, vi.fn().mockResolvedValue({ ok: true }));
    const listener = chromeApi.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = vi.fn(() => {
      throw new Error("The message port closed before a response was received.");
    });

    listener({}, {}, sendResponse);
    await flush();

    expect(sendResponse).toHaveBeenCalledTimes(1);
  });
});

describe("setupServiceWorker", () => {
  it("registers the listener at once, even when the side panel call never finishes (R-05)", () => {
    const chromeApi = fakeChrome({ setPanelBehavior: vi.fn(() => new Promise(() => {})) });

    setupServiceWorker(chromeApi, { bridge: fakeBridge() });

    expect(chromeApi.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it("opens the side panel when the toolbar icon is clicked", () => {
    const chromeApi = fakeChrome();

    setupServiceWorker(chromeApi, { bridge: fakeBridge() });

    expect(chromeApi.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  it("logs, and does not crash, when the side panel behaviour cannot be set", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const chromeApi = fakeChrome({ setPanelBehavior: vi.fn().mockRejectedValue(new Error("no sidePanel")) });

    setupServiceWorker(chromeApi, { bridge: fakeBridge() });
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("answers a side question for the active Gemini chat and refuses another sender", async () => {
    const chromeApi = fakeChrome({ tabs: [{ id: 7, url: "https://gemini.google.com/app/abc123" }] });
    const bridge = fakeBridge();
    setupServiceWorker(chromeApi, { bridge });
    const listener = chromeApi.runtime.onMessage.addListener.mock.calls[0][0];
    const own = vi.fn();
    const stranger = vi.fn();

    listener({ type: "query", text: "what is a mutex?" }, { id: OWN_ID }, own);
    listener({ type: "query", text: "what is a mutex?" }, { id: "someone-else" }, stranger);
    await flush();

    expect(own).toHaveBeenCalledWith({ ok: true, answer: "an answer" });
    expect(bridge.sendQuery).toHaveBeenCalledTimes(1);
    expect(bridge.sendQuery).toHaveBeenCalledWith("g-abc123", "what is a mutex?");
    expect(stranger.mock.calls[0][0].ok).toBe(false);
  });
});
