// REQ-Q02: every way a request can fail becomes a typed error with a message safe to show to the user.
// 422 -> ValidationError; 429/5xx -> ServerError; no connection -> NetworkError; an answer we cannot use -> ServerError.
import { describe, it, expect, vi } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { NetworkError, ValidationError, ServerError } from "../shared/errors.js";
import { loadContractExample } from "./helpers/fixtures.js";

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError("no json");
    return body;
  },
});
const makeBridge = (fetchFn) => new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, retryDelayMs: 0 });
const turn = { index: 0, role: "user", text: "hello" };

describe("a request that cannot reach the server", () => {
  it("is a NetworkError that keeps the original failure and does not leak the address", async () => {
    const cause = new TypeError("Failed to fetch");
    const bridge = makeBridge(vi.fn().mockRejectedValue(cause));

    const error = await bridge.sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.cause).toBe(cause);
    expect(error.timedOut).toBe(false);
    expect(error.message).not.toContain("localhost");
  });
});

describe("a server that answers with an error", () => {
  it("422 is a ValidationError carrying the server's code and message", async () => {
    const body = loadContractExample("error-validation.json");
    const bridge = makeBridge(vi.fn().mockResolvedValue(reply(422, body)));

    const error = await bridge.sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe(body.error);
    expect(error.message).toBe(body.message);
  });

  it.each([
    [429, "provider_rate_limit"],
    [500, "storage_error"],
    [502, "provider_bad_response"],
    [504, "provider_timeout"],
  ])("%i is a ServerError with status and code (%s)", async (status, code) => {
    const bridge = makeBridge(vi.fn().mockResolvedValue(reply(status, { error: code, message: "try later" })));

    const error = await bridge.sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toBe("try later");
  });

  it("an error body that is not JSON still becomes a ServerError with a generic message", async () => {
    const bridge = makeBridge(vi.fn().mockResolvedValue(reply(500, undefined)));

    const error = await bridge.syncTurn("s1", turn).catch((e) => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(500);
    expect(error.code).toBe("unknown_error");
    expect(error.message).toMatch(/unexpected|HTTP 500/i);
  });
});

describe("a 200 answer that cannot be used", () => {
  it.each([
    ["no answer field", {}],
    ["an empty answer", { answer: "" }],
    ["a blank answer", { answer: "   " }],
    ["an answer that is not text", { answer: 42 }],
    ["a body that is not JSON", undefined],
    ["a body that is null", null],
  ])("sendQuery: %s -> ServerError bad_response", async (_label, body) => {
    const bridge = makeBridge(vi.fn().mockResolvedValue(reply(200, body)));

    const error = await bridge.sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe("bad_response");
  });

  it.each([
    ["no turn_count", { status: "ok" }],
    ["a turn_count that is not a number", { status: "ok", turn_count: "3" }],
    ["a negative turn_count", { status: "ok", turn_count: -1 }],
    ["a status other than ok", { status: "failed", turn_count: 1 }],
    ["a body that is not JSON", undefined],
  ])("syncTurn: %s -> ServerError bad_response", async (_label, body) => {
    const bridge = makeBridge(vi.fn().mockResolvedValue(reply(200, body)));

    const error = await bridge.syncTurn("s1", turn).catch((e) => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe("bad_response");
  });

  it("the contract's own example responses are accepted", async () => {
    const queryBridge = makeBridge(vi.fn().mockResolvedValue(reply(200, loadContractExample("query-response.json"))));
    const syncBridge = makeBridge(vi.fn().mockResolvedValue(reply(200, loadContractExample("sync-response.json"))));

    expect(typeof (await queryBridge.sendQuery("s1", "hi"))).toBe("string");
    expect(await syncBridge.syncTurn("s1", turn)).toBe(1);
  });
});
