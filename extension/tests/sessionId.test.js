// REQ-F02: the session id sent to the backend must match the contract (1-64 chars of A-Za-z0-9_-)
// and must be the same for every turn of one Gemini chat, different between chats.
import { describe, it, expect } from "vitest";
import { sessionIdFor, SESSION_ID_PATTERN } from "../background/sessionId.js";

describe("sessionIdFor", () => {
  it("is the same for the same chat and different for another chat", () => {
    expect(sessionIdFor("/app/7aef0c969e3d2551")).toBe(sessionIdFor("/app/7aef0c969e3d2551"));
    expect(sessionIdFor("/app/7aef0c969e3d2551")).not.toBe(sessionIdFor("/app/aaaa1111bbbb2222"));
  });

  it("uses the chat id from the page address, also with an account prefix", () => {
    expect(sessionIdFor("/app/7aef0c969e3d2551")).toBe("g-7aef0c969e3d2551");
    expect(sessionIdFor("/u/1/app/7aef0c969e3d2551")).toBe("g-7aef0c969e3d2551");
  });

  it("ignores a query string, a hash and trailing slashes", () => {
    expect(sessionIdFor("/app/abc123?hl=en#top")).toBe("g-abc123");
    expect(sessionIdFor("/app/abc123/")).toBe("g-abc123");
  });

  it("uses one 'new chat' id while the page has no chat id yet", () => {
    for (const key of ["/app", "/app/", "/", "", undefined, null]) {
      expect(sessionIdFor(key)).toBe("g-new");
    }
  });

  it("always satisfies the API contract, whatever the address contains", () => {
    const awkward = ["/app/ab c!?é/ü", "/app/" + "x".repeat(300), "/app/..%2F..%2Fetc", "/app/" + "ä".repeat(10)];
    for (const key of awkward) {
      expect(sessionIdFor(key)).toMatch(SESSION_ID_PATTERN);
      expect(sessionIdFor(key).length).toBeLessThanOrEqual(64);
    }
  });
});
