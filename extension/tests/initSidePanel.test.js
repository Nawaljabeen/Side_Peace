import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSidePanel } from "../sidepanel/initSidePanel.js";

const okHealth = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });

function renderPage() {
  document.body.innerHTML = `
    <p id="server-status">Server: checking...</p>
    <form id="query-form">
      <textarea id="query"></textarea>
      <button id="submit" type="submit">Ask</button>
    </form>
    <div id="message"></div>
    <section id="answer"></section>`;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("initSidePanel form wiring (REQ-F04)", () => {
  beforeEach(renderPage);

  it("sends the typed question to the bridge on submit and prevents the page reload", async () => {
    const bridge = { sendQuery: vi.fn().mockResolvedValue("an answer") };
    const { ready } = initSidePanel({ document, bridge, backendUrl: "http://x", fetchFn: okHealth() });
    await ready;

    document.getElementById("query").value = "what is a mutex?";
    const submit = new Event("submit", { cancelable: true });
    document.getElementById("query-form").dispatchEvent(submit);
    await flush();

    expect(submit.defaultPrevented).toBe(true);
    expect(bridge.sendQuery).toHaveBeenCalledWith("what is a mutex?");
    expect(document.getElementById("answer").textContent).toBe("an answer");
  });
});

describe("initSidePanel server status (REQ-F04, REQ-Q02)", () => {
  beforeEach(renderPage);
  const bridge = { sendQuery: vi.fn() };

  it("shows 'connected' when the backend is healthy", async () => {
    const { ready } = initSidePanel({ document, bridge, backendUrl: "http://x", fetchFn: okHealth() });
    await ready;
    const status = document.getElementById("server-status");
    expect(status.textContent).toBe("Server: connected");
    expect(status.dataset.state).toBe("up");
  });

  it("shows 'not running' when the backend cannot be reached", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { ready } = initSidePanel({ document, bridge, backendUrl: "http://x", fetchFn });
    await ready;
    const status = document.getElementById("server-status");
    expect(status.textContent).toMatch(/not running/i);
    expect(status.dataset.state).toBe("down");
  });

  it("asks the configured backend url for /health", async () => {
    const fetchFn = okHealth();
    const { ready } = initSidePanel({ document, bridge, backendUrl: "http://localhost:8000", fetchFn });
    await ready;
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:8000/health");
  });
});
