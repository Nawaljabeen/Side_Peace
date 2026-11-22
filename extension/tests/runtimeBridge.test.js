// REQ-F04 + REQ-Q02: the side panel never calls the backend. It sends chrome.runtime messages to the
// service worker (ExtensionBridge) and turns the reply back into a result or a typed error.
import { describe, it, expect, vi } from "vitest";
import { createRuntimeBridge } from "../sidepanel/runtimeBridge.js";
import { NetworkError, ValidationError, ServerError } from "../shared/errors.js";

const bridgeWith = (sendMessage) => createRuntimeBridge({ sendMessage });

describe("createRuntimeBridge.sendQuery", () => {
  it("sends the question as a query message and returns the answer", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, answer: "a lock" });
    expect(await bridgeWith(sendMessage).sendQuery("what is a mutex?")).toBe("a lock");
    expect(sendMessage).toHaveBeenCalledWith({ type: "query", text: "what is a mutex?" });
  });

  it.each([
    ["NetworkError", NetworkError, { name: "NetworkError", message: "offline", timedOut: false }],
    ["ValidationError", ValidationError, { name: "ValidationError", message: "too long", status: 422, code: "validation_error" }],
    ["ServerError", ServerError, { name: "ServerError", message: "busy", status: 429, code: "provider_rate_limit" }],
  ])("rethrows a %s sent by the service worker", async (_name, ErrorClass, payload) => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: false, error: payload });
    const error = await bridgeWith(sendMessage).sendQuery("x").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error.message).toBe(payload.message);
  });

  it("throws a NetworkError when the service worker cannot be reached or says nothing", async () => {
    for (const sendMessage of [
      vi.fn().mockRejectedValue(new Error("Could not establish connection. Receiving end does not exist.")),
      vi.fn().mockResolvedValue(undefined),
    ]) {
      await expect(bridgeWith(sendMessage).sendQuery("x")).rejects.toBeInstanceOf(NetworkError);
    }
  });

  it("throws a ServerError for a success reply that has no answer text", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    await expect(bridgeWith(sendMessage).sendQuery("x")).rejects.toBeInstanceOf(ServerError);
  });
});

describe("createRuntimeBridge.checkHealth", () => {
  it("is true only when the service worker reports a healthy backend, and never throws", async () => {
    expect(await bridgeWith(vi.fn().mockResolvedValue({ ok: true, healthy: true })).checkHealth()).toBe(true);
    expect(await bridgeWith(vi.fn().mockResolvedValue({ ok: true, healthy: false })).checkHealth()).toBe(false);
    expect(await bridgeWith(vi.fn().mockResolvedValue({ ok: false, error: {} })).checkHealth()).toBe(false);
    expect(await bridgeWith(vi.fn().mockRejectedValue(new Error("no worker"))).checkHealth()).toBe(false);
  });

  it("sends a health message (which also wakes the service worker, R-05)", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, healthy: true });
    await bridgeWith(sendMessage).checkHealth();
    expect(sendMessage).toHaveBeenCalledWith({ type: "health" });
  });
});
