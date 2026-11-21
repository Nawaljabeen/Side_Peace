// REQ-F02 / REQ-Q02: the bridge checks every input BEFORE it sends anything, so a bad value never reaches the
// network and the caller gets a ValidationError at once. Limits are the contract's (docs/api-contract.md);
// the boundary values (just below, on, just above each limit) are the black-box cases of the test design.
import { describe, it, expect, vi } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { ValidationError } from "../shared/errors.js";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const setup = () => {
  const fetchFn = vi.fn().mockImplementation(async (url) =>
    url.endsWith("/query") ? ok({ answer: "a" }) : ok({ status: "ok", turn_count: 1 }),
  );
  return { fetchFn, bridge: new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, retryDelayMs: 0 }) };
};
const turn = (overrides = {}) => ({ index: 0, role: "user", text: "hello", ...overrides });

describe("session id (1-64 characters of A-Z a-z 0-9 _ -)", () => {
  it.each([
    ["length 1", "a"],
    ["length 64", "a".repeat(64)],
    ["every allowed character", "Az09_-"],
  ])("accepts %s", async (_label, sessionId) => {
    const { bridge } = setup();

    await expect(bridge.sendQuery(sessionId, "hi")).resolves.toBe("a");
    await expect(bridge.syncTurn(sessionId, turn())).resolves.toBe(1);
  });

  it.each([
    ["empty", ""],
    ["length 65", "a".repeat(65)],
    ["a space", "a b"],
    ["a slash", "a/b"],
    ["a non-ASCII letter", "é"],
    ["not a string", 7],
    ["undefined", undefined],
  ])("rejects %s without sending anything", async (_label, sessionId) => {
    const { bridge, fetchFn } = setup();

    await expect(bridge.sendQuery(sessionId, "hi")).rejects.toBeInstanceOf(ValidationError);
    await expect(bridge.syncTurn(sessionId, turn())).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("side question text (1-2000 characters, not blank)", () => {
  it.each([
    ["length 1", "x"],
    ["length 2000", "x".repeat(2000)],
  ])("accepts %s", async (_label, text) => {
    await expect(setup().bridge.sendQuery("s1", text)).resolves.toBe("a");
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   \n\t"],
    ["length 2001", "x".repeat(2001)],
    ["not a string", 123],
    ["null", null],
  ])("rejects %s without sending anything", async (_label, text) => {
    const { bridge, fetchFn } = setup();

    await expect(bridge.sendQuery("s1", text)).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("chat turn (index >= 0, role user or model, text 1-20000 characters)", () => {
  it.each([
    ["index 0", turn({ index: 0 })],
    ["a large index", turn({ index: 5000 })],
    ["role model", turn({ role: "model" })],
    ["text length 1", turn({ text: "x" })],
    ["text length 20000", turn({ text: "x".repeat(20000) })],
  ])("accepts %s", async (_label, value) => {
    await expect(setup().bridge.syncTurn("s1", value)).resolves.toBe(1);
  });

  it.each([
    ["null", null],
    ["not an object", "turn"],
    ["index -1", turn({ index: -1 })],
    ["index 1.5", turn({ index: 1.5 })],
    ["index as text", turn({ index: "0" })],
    ["a missing index", { role: "user", text: "hi" }],
    ["role robot", turn({ role: "robot" })],
    ["a missing role", { index: 0, text: "hi" }],
    ["empty text", turn({ text: "" })],
    ["text length 20001", turn({ text: "x".repeat(20001) })],
    ["text that is not a string", turn({ text: 5 })],
  ])("rejects %s without sending anything", async (_label, value) => {
    const { bridge, fetchFn } = setup();

    await expect(bridge.syncTurn("s1", value)).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
