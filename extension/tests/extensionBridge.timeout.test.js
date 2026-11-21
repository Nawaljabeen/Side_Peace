// REQ-Q02: the time limit covers the WHOLE exchange (waiting for the response and reading its body), so a
// server that stalls at any point cannot leave the side panel in "loading" for ever.
// Fake fetch only: no test touches the network.
import { describe, it, expect, vi, afterEach } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { NetworkError, ServerError } from "../shared/errors.js";

const makeBridge = (fetchFn, options = {}) =>
  new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, timeoutMs: 30, retryDelayMs: 0, ...options });
const stalledBody = () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }); // never settles

afterEach(() => vi.useRealTimers());

describe("ExtensionBridge time limit", () => {
  it("a server that never answers -> NetworkError (timed out), and the request is aborted", async () => {
    let seenSignal;
    const fetchFn = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          seenSignal = options.signal;
          options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );

    const error = await makeBridge(fetchFn).sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.timedOut).toBe(true);
    expect(seenSignal.aborted).toBe(true);
  });

  it("headers arrive but the body never does -> NetworkError (timed out)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(stalledBody());

    const error = await makeBridge(fetchFn).sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.timedOut).toBe(true);
  });

  it("a connection that drops while the body is read is a NetworkError, not a bad answer", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new TypeError("network error");
      },
    });

    const error = await makeBridge(fetchFn).sendQuery("s1", "hi").catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.timedOut).toBe(false);
  });

  it("a body that is not JSON is still a ServerError (the server answered, but with rubbish)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expect(makeBridge(fetchFn).sendQuery("s1", "hi")).rejects.toBeInstanceOf(ServerError);
  });

  it("a fast answer is not affected and leaves no timer behind (nothing keeps the service worker awake)", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ answer: "a lock" }) });

    const answer = await makeBridge(fetchFn, { timeoutMs: 20000 }).sendQuery("s1", "hi");

    expect(answer).toBe("a lock");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a failed request leaves no timer behind either", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await makeBridge(fetchFn, { timeoutMs: 20000 }).sendQuery("s1", "hi").catch(() => {});

    expect(vi.getTimerCount()).toBe(0);
  });
});
