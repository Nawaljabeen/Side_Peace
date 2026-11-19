import { describe, it, expect, vi } from "vitest";
import { checkServer } from "../sidepanel/serverStatus.js";

const okResponse = (body, ok = true) => ({ ok, json: async () => body });

describe("checkServer (REQ-F04, REQ-Q02)", () => {
  it("returns true when /health answers status ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ status: "ok" }));
    expect(await checkServer("http://localhost:8000", fetchFn)).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:8000/health");
  });
});

describe("checkServer failure handling (REQ-Q02)", () => {
  it("returns false instead of throwing when the network fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(checkServer("http://localhost:8000", fetchFn)).resolves.toBe(false);
  });

  it("returns false for a non-ok HTTP status or an unexpected body", async () => {
    expect(await checkServer("http://x", vi.fn().mockResolvedValue(okResponse({}, false)))).toBe(false);
    expect(await checkServer("http://x", vi.fn().mockResolvedValue(okResponse({ status: "down" })))).toBe(false);
    const badJson = { ok: true, json: async () => { throw new SyntaxError("bad json"); } };
    expect(await checkServer("http://x", vi.fn().mockResolvedValue(badJson))).toBe(false);
  });
});
