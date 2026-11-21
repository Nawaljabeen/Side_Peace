// REQ-F02 + REQ-Q02: the ExtensionBridge is the only code that talks to the backend (DEC-09).
// Fake fetch only: no test touches the network.
import { describe, it, expect, vi, afterEach } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { NetworkError, ValidationError, ServerError } from "../shared/errors.js";
import { loadContractExample } from "./helpers/fixtures.js";

const BASE = "http://localhost:8000";
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError("no json");
    return body;
  },
});
const makeBridge = (fetchFn, options = {}) => new ExtensionBridge({ baseUrl: BASE, fetchFn, ...options });
const turn = (index, text = "hello", role = "user") => ({ index, role, text });

afterEach(() => vi.useRealTimers());

describe("ExtensionBridge.sendQuery", () => {
  it("POSTs the contract body to /query and returns the answer text", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { answer: "a lock" }));

    expect(await makeBridge(fetchFn).sendQuery("s1", "what is a mutex?")).toBe("a lock");

    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/query`);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(options.body);
    expect(body).toEqual({ session_id: "s1", text: "what is a mutex?" });
    expect(Object.keys(body).sort()).toEqual(Object.keys(loadContractExample("query-request.json")).sort());
  });

  it("treats a 200 without an answer as a ServerError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, {}));
    await expect(makeBridge(fetchFn).sendQuery("s1", "hi")).rejects.toBeInstanceOf(ServerError);
  });
});

describe("ExtensionBridge.syncTurn", () => {
  it("POSTs the contract body to /sync and returns the turn count", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "ok", turn_count: 3 }));

    expect(await makeBridge(fetchFn).syncTurn("s1", turn(2, "hi", "model"))).toBe(3);

    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BASE}/sync`);
    const body = JSON.parse(options.body);
    expect(body).toEqual({ session_id: "s1", turn: { index: 2, role: "model", text: "hi" } });
    expect(Object.keys(body).sort()).toEqual(Object.keys(loadContractExample("sync-request.json")).sort());
  });

  describe("exactly once", () => {
    const okFetch = () => vi.fn().mockResolvedValue(reply(200, { status: "ok", turn_count: 1 }));

    it("does not send the same turn twice", async () => {
      const fetchFn = okFetch();
      const bridge = makeBridge(fetchFn);
      await bridge.syncTurn("s1", turn(0));
      await bridge.syncTurn("s1", turn(0));
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("sends again when the text of that index changed, or for another session", async () => {
      const fetchFn = okFetch();
      const bridge = makeBridge(fetchFn);
      await bridge.syncTurn("s1", turn(0, "first"));
      await bridge.syncTurn("s1", turn(0, "first, longer"));
      await bridge.syncTurn("s2", turn(0, "first, longer"));
      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("does not mark a turn as sent when the request failed, so a retry goes out", async () => {
      const fetchFn = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(reply(200, { status: "ok", turn_count: 1 }));
      const bridge = makeBridge(fetchFn);
      await expect(bridge.syncTurn("s1", turn(0))).rejects.toBeInstanceOf(NetworkError);
      await bridge.syncTurn("s1", turn(0));
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("collapses two identical turns that are in flight at the same moment", async () => {
      const fetchFn = okFetch();
      const bridge = makeBridge(fetchFn);
      await Promise.all([bridge.syncTurn("s1", turn(0)), bridge.syncTurn("s1", turn(0))]);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ExtensionBridge status mapping (REQ-Q02)", () => {
  it("maps 422 to ValidationError and keeps the backend message", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(422, { error: "validation_error", message: "text: too long" }));
    const error = await makeBridge(fetchFn).sendQuery("s1", "x").catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe("text: too long");
  });

  it.each([
    [429, "provider_rate_limit"],
    [500, "storage_error"],
    [502, "provider_bad_response"],
    [504, "provider_timeout"],
  ])("maps %i to a ServerError with status and code", async (status, code) => {
    const fetchFn = vi.fn().mockResolvedValue(reply(status, { error: code, message: "safe text" }));
    const error = await makeBridge(fetchFn).sendQuery("s1", "x").catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it("still gives a typed error when the error body is not JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(503, undefined));
    const error = await makeBridge(fetchFn).sendQuery("s1", "x").catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(503);
  });

  it("maps a rejected fetch to NetworkError", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(makeBridge(fetchFn).sendQuery("s1", "x")).rejects.toBeInstanceOf(NetworkError);
  });

  it("aborts a request that takes too long and reports a NetworkError that timed out", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const pending = makeBridge(fetchFn, { timeoutMs: 50 }).sendQuery("s1", "x").catch((e) => e);

    await vi.advanceTimersByTimeAsync(60);

    const error = await pending;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.timedOut).toBe(true);
  });
});

describe("ExtensionBridge.checkHealth", () => {
  it("is true only for a healthy backend and never throws", async () => {
    expect(await makeBridge(vi.fn().mockResolvedValue(reply(200, { status: "ok" }))).checkHealth()).toBe(true);
    expect(await makeBridge(vi.fn().mockResolvedValue(reply(200, { status: "down" }))).checkHealth()).toBe(false);
    expect(await makeBridge(vi.fn().mockResolvedValue(reply(500, {}))).checkHealth()).toBe(false);
    expect(await makeBridge(vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))).checkHealth()).toBe(false);
  });

  it("asks GET /health", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "ok" }));
    await makeBridge(fetchFn).checkHealth();
    expect(fetchFn.mock.calls[0][0]).toBe(`${BASE}/health`);
  });
});
