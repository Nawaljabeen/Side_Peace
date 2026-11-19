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
