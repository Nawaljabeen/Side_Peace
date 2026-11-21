// REQ-F02, QR-03: when the user asks a side question the service worker must know WHICH Gemini chat they are
// looking at. It reads the active tab and accepts it only when it is a Gemini page.
// Fake chrome only: no browser is started.
import { describe, it, expect, vi } from "vitest";
import { getActiveConversation } from "../background/serviceWorkerSetup.js";

const fakeChrome = (tabs) => ({ tabs: { query: vi.fn().mockResolvedValue(tabs) } });

describe("getActiveConversation", () => {
  it("returns the address path and the tab id of the active Gemini tab", async () => {
    const chromeApi = fakeChrome([{ id: 7, url: "https://gemini.google.com/app/7aef0c969e3d2551?hl=en" }]);

    expect(await getActiveConversation(chromeApi)).toEqual({ path: "/app/7aef0c969e3d2551", tabId: 7 });
    expect(chromeApi.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it("returns the path of a new chat too", async () => {
    expect(await getActiveConversation(fakeChrome([{ id: 3, url: "https://gemini.google.com/app" }]))).toEqual({
      path: "/app",
      tabId: 3,
    });
  });

  it.each([
    ["another site", { id: 3, url: "https://example.com/app/abc" }],
    ["a look-alike host", { id: 3, url: "https://gemini.google.com.evil.example/app/abc" }],
    ["plain http", { id: 3, url: "http://gemini.google.com/app/abc" }],
    ["a tab without a url", { id: 3 }],
    ["a url that cannot be parsed", { id: 3, url: "not a url" }],
    ["a tab without an id", { url: "https://gemini.google.com/app/abc" }],
  ])("returns null for %s", async (_label, tab) => {
    expect(await getActiveConversation(fakeChrome([tab]))).toBeNull();
  });

  it("returns null when there is no active tab", async () => {
    expect(await getActiveConversation(fakeChrome([]))).toBeNull();
  });

  it("returns null (and does not throw) when the browser cannot be asked", async () => {
    const chromeApi = { tabs: { query: vi.fn().mockRejectedValue(new Error("No window")) } };

    expect(await getActiveConversation(chromeApi)).toBeNull();
  });
});
