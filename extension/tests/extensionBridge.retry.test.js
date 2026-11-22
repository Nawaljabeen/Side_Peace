// REQ-F02 / REQ-Q02: a chat turn that fails to reach the backend for a short, temporary reason must not be
// lost. DOMObserver reports each turn only once, so if the first send fails nothing else would send it again.
// Fake fetch only: no test touches the network.
import { describe, it, expect, vi } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { NetworkError, ValidationError, ServerError } from "../shared/errors.js";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const makeBridge = (fetchFn, options = {}) =>
  new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, retryDelayMs: 0, ...options });
const turn = { index: 0, role: "user", text: "hello" };
const synced = (count = 1) => reply(200, { status: "ok", turn_count: count });

describe("ExtensionBridge.syncTurn retry", () => {
  it("retries after a network failure and then succeeds", async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(synced());

    expect(await makeBridge(fetchFn).syncTurn("s1", turn)).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 503])("retries after a %i from the server", async (status) => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reply(status, { error: "internal_error", message: "busy" }))
      .mockResolvedValueOnce(synced());

    expect(await makeBridge(fetchFn).syncTurn("s1", turn)).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 422, because the same turn would be refused again", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(422, { error: "validation_error", message: "bad turn" }));

    await expect(makeBridge(fetchFn).syncTurn("s1", turn)).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry when the turn itself is invalid (nothing is sent at all)", async () => {
    const fetchFn = vi.fn();

    await expect(makeBridge(fetchFn).syncTurn("s1", { index: -1, role: "user", text: "x" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gives up after 3 attempts and reports the last error", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(makeBridge(fetchFn).syncTurn("s1", turn)).rejects.toBeInstanceOf(NetworkError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("gives up after 3 attempts on a server that keeps failing", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(500, { error: "storage_error", message: "disk" }));

    await expect(makeBridge(fetchFn).syncTurn("s1", turn)).rejects.toBeInstanceOf(ServerError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("waits longer before each retry (0.5 s, then 1 s with the default delay)", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn }).syncTurn("s1", turn).catch((e) => e);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(await result).toBeInstanceOf(NetworkError);
    vi.useRealTimers();
  });

  it("sends the same turn again when called again after every attempt failed (nothing is remembered as sent)", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("x"))
      .mockRejectedValueOnce(new TypeError("x"))
      .mockRejectedValueOnce(new TypeError("x"))
      .mockResolvedValueOnce(synced());
    const bridge = makeBridge(fetchFn);

    await expect(bridge.syncTurn("s1", turn)).rejects.toBeInstanceOf(NetworkError);
    expect(await bridge.syncTurn("s1", turn)).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("never retries a side question (the user is waiting and it would cost a second model call)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(makeBridge(fetchFn).sendQuery("s1", "what is a mutex?")).rejects.toBeInstanceOf(NetworkError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
