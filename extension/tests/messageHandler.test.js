// The service worker's message entry point (REQ-F02, REQ-Q02): the content script and the side panel never
// call the backend themselves, they send chrome.runtime messages and get back {ok:true,...} or {ok:false,error}.
import { describe, it, expect, vi } from "vitest";
import { createMessageHandler } from "../background/messageHandler.js";
import { NetworkError, ServerError } from "../shared/errors.js";

const OWN_ID = "ext-id";
const ownSender = { id: OWN_ID };

function setup({ conversationPath = "/app/abc123", bridge } = {}) {
  const fakeBridge = bridge ?? {
    sendQuery: vi.fn().mockResolvedValue("an answer"),
    syncTurn: vi.fn().mockResolvedValue(2),
    checkHealth: vi.fn().mockResolvedValue(true),
  };
  const handle = createMessageHandler({
    bridge: fakeBridge,
    getActiveConversationPath: vi.fn().mockResolvedValue(conversationPath),
    ownExtensionId: OWN_ID,
  });
  return { handle, bridge: fakeBridge };
}

describe("sync-turn messages from the content script", () => {
  it("syncs the turn under the session of the chat it came from", async () => {
    const { handle, bridge } = setup();
    const turn = { index: 1, role: "model", text: "hi" };

    const response = await handle({ type: "sync-turn", conversationPath: "/app/zzz999", turn }, ownSender);

    expect(response).toEqual({ ok: true, turnCount: 2 });
    expect(bridge.syncTurn).toHaveBeenCalledWith("g-zzz999", turn);
  });

  it.each([
    ["a negative index", { index: -1, role: "user", text: "x" }],
    ["a non-integer index", { index: 1.5, role: "user", text: "x" }],
    ["an unknown role", { index: 0, role: "robot", text: "x" }],
    ["empty text", { index: 0, role: "user", text: "" }],
    ["text that is not a string", { index: 0, role: "user", text: 42 }],
    ["text over 20000 characters", { index: 0, role: "user", text: "x".repeat(20001) }],
  ])("rejects %s without calling the backend", async (_label, turn) => {
    const { handle, bridge } = setup();
    const response = await handle({ type: "sync-turn", conversationPath: "/app/a", turn }, ownSender);
    expect(response.ok).toBe(false);
    expect(response.error.name).toBe("ValidationError");
    expect(bridge.syncTurn).not.toHaveBeenCalled();
  });
});

describe("query messages from the side panel", () => {
  it("asks in the session of the chat in the active tab and returns the answer", async () => {
    const { handle, bridge } = setup({ conversationPath: "/app/abc123" });

    const response = await handle({ type: "query", text: "  what is a mutex? " }, ownSender);

    expect(response).toEqual({ ok: true, answer: "an answer" });
    expect(bridge.sendQuery).toHaveBeenCalledWith("g-abc123", "what is a mutex?");
  });

  it.each([["empty", "   "], ["not a string", 7], ["too long", "x".repeat(2001)]])(
    "rejects text that is %s without calling the backend",
    async (_label, text) => {
      const { handle, bridge } = setup();
      const response = await handle({ type: "query", text }, ownSender);
      expect(response.ok).toBe(false);
      expect(response.error.name).toBe("ValidationError");
      expect(bridge.sendQuery).not.toHaveBeenCalled();
    },
  );
});

describe("health messages", () => {
  it("reports whether the backend is healthy", async () => {
    const { handle } = setup();
    expect(await handle({ type: "health" }, ownSender)).toEqual({ ok: true, healthy: true });
  });
});

describe("failure handling (REQ-Q02)", () => {
  it("turns a bridge error into a typed error payload instead of throwing", async () => {
    const bridge = { sendQuery: vi.fn().mockRejectedValue(new NetworkError("offline")), syncTurn: vi.fn(), checkHealth: vi.fn() };
    const { handle } = setup({ bridge });

    const response = await handle({ type: "query", text: "hi" }, ownSender);

    expect(response).toEqual({ ok: false, error: { name: "NetworkError", message: "offline", timedOut: false } });
  });

  it("keeps the status and code of a ServerError", async () => {
    const bridge = {
      sendQuery: vi.fn().mockRejectedValue(new ServerError("busy", { status: 429, code: "provider_rate_limit" })),
      syncTurn: vi.fn(),
      checkHealth: vi.fn(),
    };
    const response = await setup({ bridge }).handle({ type: "query", text: "hi" }, ownSender);
    expect(response.error).toMatchObject({ name: "ServerError", status: 429, code: "provider_rate_limit" });
  });

  it("never leaks the message of an unexpected bug", async () => {
    const bridge = { sendQuery: vi.fn().mockRejectedValue(new TypeError("secret /path/to/file")), syncTurn: vi.fn(), checkHealth: vi.fn() };
    const response = await setup({ bridge }).handle({ type: "query", text: "hi" }, ownSender);
    expect(response.ok).toBe(false);
    expect(JSON.stringify(response)).not.toMatch(/secret/);
  });
});

describe("who may talk to the bridge", () => {
  it("rejects messages from another extension or a web page", async () => {
    const { handle, bridge } = setup();
    for (const sender of [{ id: "someone-else" }, {}, undefined]) {
      const response = await handle({ type: "query", text: "hi" }, sender);
      expect(response.ok).toBe(false);
    }
    expect(bridge.sendQuery).not.toHaveBeenCalled();
  });

  it("rejects unknown or malformed messages", async () => {
    const { handle } = setup();
    for (const message of [{ type: "delete-everything" }, {}, null, "query", 42]) {
      const response = await handle(message, ownSender);
      expect(response.ok).toBe(false);
      expect(response.error.name).toBe("ValidationError");
    }
  });
});
