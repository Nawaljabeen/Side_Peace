// REQ-F02 / R-05: the service worker registers its message listener and keeps the side-panel behaviour.
// The chrome API is injected, so these tests use a fake object.
import { describe, it, expect, vi } from "vitest";
import { setUpServiceWorker, getActiveConversationPath } from "../background/serviceWorkerSetup.js";

function fakeChrome({ tabs = [], id = "ext-id" } = {}) {
  const listeners = [];
  return {
    runtime: { id, onMessage: { addListener: (listener) => listeners.push(listener) } },
    sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
    tabs: { query: vi.fn().mockResolvedValue(tabs) },
    listeners,
  };
}

describe("setUpServiceWorker", () => {
  it("keeps the side panel opening when the toolbar icon is clicked", () => {
    const chromeApi = fakeChrome();
    setUpServiceWorker(chromeApi, { fetchFn: vi.fn() });
    expect(chromeApi.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  it("registers one message listener that answers asynchronously", async () => {
    const chromeApi = fakeChrome();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
    setUpServiceWorker(chromeApi, { fetchFn });
    expect(chromeApi.listeners).toHaveLength(1);

    const sendResponse = vi.fn();
    const keepsChannelOpen = chromeApi.listeners[0]({ type: "health" }, { id: "ext-id" }, sendResponse);
    expect(keepsChannelOpen).toBe(true); // required by chrome.runtime when the reply comes later

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, healthy: true });
  });

  it("ignores a rejected side-panel setting instead of crashing the worker", async () => {
    const chromeApi = fakeChrome();
    chromeApi.sidePanel.setPanelBehavior.mockRejectedValue(new Error("unsupported"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => setUpServiceWorker(chromeApi, { fetchFn: vi.fn() })).not.toThrow();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });
});

describe("getActiveConversationPath", () => {
  it("is the path of the Gemini chat in the active tab", async () => {
    const chromeApi = fakeChrome({ tabs: [{ url: "https://gemini.google.com/app/7aef0c969e3d2551?hl=en" }] });
    expect(await getActiveConversationPath(chromeApi)).toBe("/app/7aef0c969e3d2551");
  });

  it.each([
    ["no active tab", []],
    ["a tab without an address", [{}]],
    ["another website", [{ url: "https://example.com/app/abc" }]],
    ["an address that is not a URL", [{ url: "not a url" }]],
  ])("is empty for %s, so the 'new chat' session is used", async (_label, tabs) => {
    expect(await getActiveConversationPath(fakeChrome({ tabs }))).toBe("");
  });

  it("asks only for the active tab of the current window", async () => {
    const chromeApi = fakeChrome();
    await getActiveConversationPath(chromeApi);
    expect(chromeApi.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });
});
