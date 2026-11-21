// REQ-F04 / R-05: the side panel asks "is the server there?" (GET /health) before the user types a question.
// checkHealth never throws: any problem simply means "not healthy".
import { describe, it, expect, vi } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { loadContractExample } from "./helpers/fixtures.js";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const makeBridge = (fetchFn, options = {}) =>
  new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, timeoutMs: 30, retryDelayMs: 0, ...options });

describe("ExtensionBridge.checkHealth", () => {
  it("is true when GET /health answers the contract's example body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, loadContractExample("health-response.json")));

    expect(await makeBridge(fetchFn).checkHealth()).toBe(true);

    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe("http://localhost:8000/health");
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("omit");
    expect(options.body).toBeUndefined();
  });

  it.each([
    ["a status other than ok", reply(200, { status: "starting" })],
    ["an answer without status", reply(200, {})],
    ["an answer that is not JSON", { ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } }],
    ["a 500", reply(500, { error: "internal_error", message: "boom" })],
    ["a 404", reply(404, { error: "not_found", message: "no" })],
  ])("is false for %s", async (_label, response) => {
    expect(await makeBridge(vi.fn().mockResolvedValue(response)).checkHealth()).toBe(false);
  });

  it("is false (and does not throw) when the server cannot be reached", async () => {
    expect(await makeBridge(vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))).checkHealth()).toBe(false);
  });

  it("is false when the server stalls, after the time limit", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });

    expect(await makeBridge(fetchFn).checkHealth()).toBe(false);
  });

  it("is not retried", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await makeBridge(fetchFn).checkHealth();

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
