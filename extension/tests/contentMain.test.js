// REQ-F01, REQ-F02, QR-03: startContent() wires the real DOMObserver to the TurnRelay on the Gemini page.
// Real jsdom DOM, fake chrome.runtime.sendMessage.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startContent } from "../content/main.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const chatHtml = `
  <user-query><p class="query-text-line">what is a mutex?</p></user-query>
  <model-response><message-content><div class="markdown"><p>A lock.</p></div></message-content></model-response>`;

function fakeWindow({ hostname = "gemini.google.com", pathname = "/app/abc123" } = {}) {
  const listeners = {};
  return {
    location: { hostname, pathname },
    navigation: {
      addEventListener: vi.fn((name, listener) => { listeners[name] = listener; }),
      removeEventListener: vi.fn(),
    },
    fire: (name) => listeners[name]?.(),
  };
}
const fakeChrome = () => ({ runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, turnCount: 1 }) } });

describe("startContent", () => {
  let stop;
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => { stop?.(); stop = undefined; });

  it("sends the turns already on the page, tagged with the chat path", async () => {
    document.body.innerHTML = chatHtml;
    const chromeApi = fakeChrome();

    stop = startContent({ document, window: fakeWindow(), chromeApi });
    await flush();

    const sent = chromeApi.runtime.sendMessage.mock.calls.map(([message]) => message);
    expect(sent).toEqual([
      { type: "sync-turn", conversationPath: "/app/abc123", turn: { index: 0, role: "user", text: "what is a mutex?" } },
      { type: "sync-turn", conversationPath: "/app/abc123", turn: { index: 1, role: "model", text: "A lock." } },
    ]);
  });

  it("sends a turn that appears later, after the text has settled", async () => {
    const chromeApi = fakeChrome();
    stop = startContent({ document, window: fakeWindow(), chromeApi, debounceMs: 5 });

    document.body.innerHTML = chatHtml;
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("does nothing on a page that is not Gemini (QR-03)", async () => {
    document.body.innerHTML = chatHtml;
    const chromeApi = fakeChrome();
    const win = fakeWindow({ hostname: "evil.example.com" });

    stop = startContent({ document, window: win, chromeApi });
    await flush();

    expect(stop).toBeTypeOf("function");
    expect(chromeApi.runtime.sendMessage).not.toHaveBeenCalled();
    expect(win.navigation.addEventListener).not.toHaveBeenCalled();
  });

  it("sends the chat again under the new path when Gemini navigates inside the page", async () => {
    document.body.innerHTML = chatHtml;
    const chromeApi = fakeChrome();
    const win = fakeWindow({ pathname: "/app" });
    stop = startContent({ document, window: win, chromeApi });
    await flush();
    chromeApi.runtime.sendMessage.mockClear();

    win.location.pathname = "/app/abc123";
    win.fire("navigatesuccess");
    await flush();

    const paths = chromeApi.runtime.sendMessage.mock.calls.map(([message]) => message.conversationPath);
    expect(paths).toEqual(["/app/abc123", "/app/abc123"]);
  });

  it("still works when the browser has no Navigation API", async () => {
    document.body.innerHTML = chatHtml;
    const win = fakeWindow();
    delete win.navigation;

    expect(() => { stop = startContent({ document, window: win, chromeApi: fakeChrome() }); }).not.toThrow();
  });

  it("stops everything when the returned function is called", async () => {
    const chromeApi = fakeChrome();
    const win = fakeWindow();
    stop = startContent({ document, window: win, chromeApi, debounceMs: 5 });

    stop();
    document.body.innerHTML = chatHtml;
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(chromeApi.runtime.sendMessage).not.toHaveBeenCalled();
    expect(win.navigation.removeEventListener).toHaveBeenCalledWith("navigatesuccess", expect.any(Function));
  });
});
