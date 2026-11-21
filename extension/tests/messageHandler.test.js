// REQ-F02, REQ-Q02: the service worker's message handler is the one place where the content script and the side
// panel meet the ExtensionBridge. It checks who is asking, picks the session, and turns every outcome into
// {ok: true, ...} or {ok: false, error: <plain object>}. It never throws. Fake bridge only: no network.
import { describe, it, expect, vi } from "vitest";
import { createMessageHandler } from "../background/messageHandler.js";
import { NetworkError, ServerError, ValidationError } from "../shared/errors.js";

const OWN_ID = "my-extension-id";
const turn = { index: 0, role: "user", text: "hello" };

function setup({ conversation = { path: "/app/abc123", tabId: 7 }, bridgeOverrides = {} } = {}) {
  const bridge = {
    syncTurn: vi.fn().mockResolvedValue(1),
    sendQuery: vi.fn().mockResolvedValue("an answer"),
    checkHealth: vi.fn().mockResolvedValue(true),
    ...bridgeOverrides,
  };
  const getActiveConversation = vi.fn().mockResolvedValue(conversation);
  const handle = createMessageHandler({ bridge, getActiveConversation, ownExtensionId: OWN_ID });
  return { handle, bridge, getActiveConversation };
}
const fromContentScript = (tabId = 7) => ({ id: OWN_ID, tab: { id: tabId } });
const fromSidePanel = { id: OWN_ID };

describe("sync-turn (from the content script)", () => {
  it("saves the turn in the session of the chat it came from", async () => {
    const { handle, bridge } = setup();

    const reply = await handle({ type: "sync-turn", conversationPath: "/app/abc123", turn }, fromContentScript());

    expect(reply).toEqual({ ok: true, turnCount: 1 });
    expect(bridge.syncTurn).toHaveBeenCalledWith("g-abc123", turn);
  });

  it("uses the sender's tab to keep two new chats apart", async () => {
    const { handle, bridge } = setup();

    await handle({ type: "sync-turn", conversationPath: "/app", turn }, fromContentScript(7));
    await handle({ type: "sync-turn", conversationPath: "/app", turn }, fromContentScript(9));

    expect(bridge.syncTurn.mock.calls.map(([sessionId]) => sessionId)).toEqual(["g-new-7", "g-new-9"]);
  });

  it("falls back to the shared new-chat id when the sender has no tab", async () => {
    const { handle, bridge } = setup();

    await handle({ type: "sync-turn", conversationPath: "/app", turn }, fromSidePanel);

    expect(bridge.syncTurn).toHaveBeenCalledWith("g-new", turn);
  });
});

describe("query (from the side panel)", () => {
  it("asks in the session of the chat the user is looking at", async () => {
    const { handle, bridge } = setup({ conversation: { path: "/app/abc123", tabId: 7 } });

    const reply = await handle({ type: "query", text: "what is a mutex?" }, fromSidePanel);

    expect(reply).toEqual({ ok: true, answer: "an answer" });
    expect(bridge.sendQuery).toHaveBeenCalledWith("g-abc123", "what is a mutex?");
  });

  it("uses the same session for a new chat as the turns synced from that tab", async () => {
    const { handle, bridge } = setup({ conversation: { path: "/app", tabId: 7 } });

    await handle({ type: "sync-turn", conversationPath: "/app", turn }, fromContentScript(7));
    await handle({ type: "query", text: "hi" }, fromSidePanel);

    expect(bridge.sendQuery.mock.calls[0][0]).toBe(bridge.syncTurn.mock.calls[0][0]);
  });

  it("tells the user to open a Gemini chat when no Gemini tab is active (nothing is sent)", async () => {
    const { handle, bridge } = setup({ conversation: null });

    const reply = await handle({ type: "query", text: "hi" }, fromSidePanel);

    expect(reply.ok).toBe(false);
    expect(reply.error.name).toBe("ValidationError");
    expect(reply.error.message).toMatch(/gemini/i);
    expect(bridge.sendQuery).not.toHaveBeenCalled();
  });
});

describe("health (from the side panel; it also wakes the service worker)", () => {
  it.each([true, false])("reports the bridge's answer (%s)", async (healthy) => {
    const { handle } = setup({ bridgeOverrides: { checkHealth: vi.fn().mockResolvedValue(healthy) } });

    expect(await handle({ type: "health" }, fromSidePanel)).toEqual({ ok: true, healthy });
  });
});

describe("who and what is accepted", () => {
  it.each([
    ["another extension", { id: "someone-else" }],
    ["a web page", { url: "https://evil.example" }],
    ["no sender", undefined],
    ["a sender without an id", {}],
  ])("refuses a message from %s and sends nothing", async (_label, sender) => {
    const { handle, bridge } = setup();

    const reply = await handle({ type: "query", text: "hi" }, sender);

    expect(reply.ok).toBe(false);
    expect(reply.error.name).toBe("ValidationError");
    expect(bridge.sendQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown type", { type: "format-disk" }],
    ["no type", {}],
    ["null", null],
    ["a string", "query"],
    ["undefined", undefined],
  ])("refuses %s", async (_label, message) => {
    const { handle } = setup();

    const reply = await handle(message, fromSidePanel);

    expect(reply.ok).toBe(false);
    expect(reply.error.name).toBe("ValidationError");
  });
});

describe("failures", () => {
  it.each([
    ["a NetworkError", new NetworkError("down", { timedOut: true }), "NetworkError"],
    ["a ServerError", new ServerError("busy", { status: 503, code: "provider_rate_limit" }), "ServerError"],
    ["a ValidationError", new ValidationError("bad text"), "ValidationError"],
  ])("passes %s on as a plain error object", async (_label, error, name) => {
    const { handle } = setup({ bridgeOverrides: { sendQuery: vi.fn().mockRejectedValue(error) } });

    const reply = await handle({ type: "query", text: "hi" }, fromSidePanel);

    expect(reply).toEqual({ ok: false, error: expect.objectContaining({ name, message: error.message }) });
    expect(JSON.parse(JSON.stringify(reply))).toEqual(reply);
  });

  it.each([
    ["an Error with internal details", new TypeError("C:\\secret\\path is broken")],
    ["a thrown string", "boom"],
  ])("never throws and never leaks the details of %s", async (_label, thrown) => {
    const { handle } = setup({ bridgeOverrides: { syncTurn: vi.fn().mockRejectedValue(thrown) } });

    const reply = await handle({ type: "sync-turn", conversationPath: "/app/a", turn }, fromContentScript());

    expect(reply.ok).toBe(false);
    expect(reply.error.code).toBe("internal_error");
    expect(JSON.stringify(reply)).not.toContain("secret");
  });

  it("lets the bridge refuse a bad turn (the handler does not send it on unchecked)", async () => {
    const bridge = { syncTurn: vi.fn().mockRejectedValue(new ValidationError("A turn needs ...")), sendQuery: vi.fn(), checkHealth: vi.fn() };
    const handle = createMessageHandler({
      bridge,
      getActiveConversation: async () => null,
      ownExtensionId: OWN_ID,
    });

    const reply = await handle({ type: "sync-turn", conversationPath: "/app/a", turn: { index: -1 } }, fromContentScript());

    expect(reply).toEqual({ ok: false, error: expect.objectContaining({ name: "ValidationError" }) });
  });
});
