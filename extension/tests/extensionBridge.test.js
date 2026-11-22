// REQ-F02: the ExtensionBridge is the only code that talks to the backend (DEC-09). Fake fetch only:
// no test touches the network. The request bodies are checked against the examples in docs/contract/.
import { describe, it, expect, vi, afterEach } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { BACKEND_URL } from "../shared/constants.js";
import { loadContractExample } from "./helpers/fixtures.js";

const BASE = "http://localhost:8000";
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const makeBridge = (fetchFn, options = {}) => new ExtensionBridge({ baseUrl: BASE, fetchFn, ...options });
const turn = (index = 0, text = "hello", role = "user") => ({ index, role, text });

afterEach(() => vi.unstubAllGlobals());

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

  it("never sends cookies or other credentials to the backend", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { answer: "a" }));

    await makeBridge(fetchFn).sendQuery("s1", "hi");

    expect(fetchFn.mock.calls[0][1].credentials).toBe("omit");
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
    const example = loadContractExample("sync-request.json");
    expect(Object.keys(body).sort()).toEqual(Object.keys(example).sort());
    expect(Object.keys(body.turn).sort()).toEqual(Object.keys(example.turn).sort());
  });

  it("sends only the three contract fields of a turn, even if the caller passes more", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "ok", turn_count: 1 }));

    await makeBridge(fetchFn).syncTurn("s1", { index: 0, role: "user", text: "hi", extra: "x" });

    expect(Object.keys(JSON.parse(fetchFn.mock.calls[0][1].body).turn).sort()).toEqual(["index", "role", "text"]);
  });
});

describe("ExtensionBridge configuration", () => {
  it("uses the configured base URL and ignores a trailing slash", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { answer: "a" }));

    await new ExtensionBridge({ baseUrl: "http://127.0.0.1:9000/", fetchFn }).sendQuery("s1", "hi");

    expect(fetchFn.mock.calls[0][0]).toBe("http://127.0.0.1:9000/query");
  });

  it("defaults to the backend address in shared/constants.js and to the global fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(reply(200, { answer: "a" }));
    vi.stubGlobal("fetch", fetchSpy);

    await new ExtensionBridge().sendQuery("s1", "hi");

    expect(fetchSpy.mock.calls[0][0]).toBe(`${BACKEND_URL}/query`);
  });

  it.each([
    ["an empty baseUrl", { baseUrl: "  " }, TypeError],
    ["a baseUrl that is not a string", { baseUrl: 8000 }, TypeError],
    ["a fetchFn that is not a function", { fetchFn: "nope" }, TypeError],
    ["a timeout of 0", { timeoutMs: 0 }, RangeError],
    ["a negative timeout", { timeoutMs: -5 }, RangeError],
    ["a timeout that is not a finite number", { timeoutMs: Infinity }, RangeError],
    ["a retry delay below 0", { retryDelayMs: -1 }, RangeError],
  ])("refuses %s", (_label, options, ErrorClass) => {
    expect(() => new ExtensionBridge({ fetchFn: vi.fn(), ...options })).toThrow(ErrorClass);
  });
});
