import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSidePanel } from "../sidepanel/initSidePanel.js";

// The panel only knows its bridge (sendQuery, checkHealth); it never sees a URL or fetch.
const makeBridge = ({ healthy = true, answer = "an answer" } = {}) => ({
  sendQuery: vi.fn().mockResolvedValue(answer),
  checkHealth: vi.fn().mockResolvedValue(healthy),
});

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
    const bridge = makeBridge();
    const { ready } = initSidePanel({ document, bridge });
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

  it("shows 'connected' when the bridge reports a healthy backend", async () => {
    const { ready } = initSidePanel({ document, bridge: makeBridge({ healthy: true }) });
    await ready;
    const status = document.getElementById("server-status");
    expect(status.textContent).toBe("Server: connected");
    expect(status.dataset.state).toBe("up");
  });

  it("shows 'not running' when the backend cannot be reached", async () => {
    const { ready } = initSidePanel({ document, bridge: makeBridge({ healthy: false }) });
    await ready;
    const status = document.getElementById("server-status");
    expect(status.textContent).toMatch(/not running/i);
    expect(status.dataset.state).toBe("down");
  });

  it("shows 'not running' instead of failing when the health check itself throws", async () => {
    const bridge = makeBridge();
    bridge.checkHealth.mockRejectedValue(new Error("no service worker"));
    const { ready } = initSidePanel({ document, bridge });
    await ready;
    expect(document.getElementById("server-status").dataset.state).toBe("down");
  });
});

describe("initSidePanel defensive checks (REQ-Q02)", () => {
  it("names the missing element instead of failing with a vague TypeError", () => {
    document.body.innerHTML = '<form id="query-form"></form>';
    expect(() => initSidePanel({ document, bridge: makeBridge() })).toThrow(/#query/);
  });
});
