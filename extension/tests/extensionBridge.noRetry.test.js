// REQ-F02: only temporary failures are retried (see extensionBridge.retry.test.js). These cases are NOT
// temporary: the same turn would fail again, so retrying would only waste time. Verification test: it passes
// on first run because the rule already holds; it pins the boundary of "temporary" (429 and 5xx only).
import { describe, it, expect, vi } from "vitest";
import { ExtensionBridge } from "../background/extensionBridge.js";
import { ServerError } from "../shared/errors.js";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const turn = { index: 0, role: "user", text: "hello" };
const bridgeFor = (fetchFn) => new ExtensionBridge({ baseUrl: "http://localhost:8000", fetchFn, retryDelayMs: 0 });

describe("failures that are not retried", () => {
  it.each([400, 404, 405])("a %i answer is reported at once", async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(reply(status, { error: "not_found", message: "no" }));

    await expect(bridgeFor(fetchFn).syncTurn("s1", turn)).rejects.toBeInstanceOf(ServerError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("a 200 answer that cannot be used is reported at once", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(200, { status: "ok" }));

    await expect(bridgeFor(fetchFn).syncTurn("s1", turn)).rejects.toMatchObject({ code: "bad_response" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("599 is still a server failure and is retried (upper end of the 5xx range)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(599, { error: "internal_error", message: "x" }));

    await expect(bridgeFor(fetchFn).syncTurn("s1", turn)).rejects.toBeInstanceOf(ServerError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
