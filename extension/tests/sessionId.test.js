// REQ-F02: one Gemini chat = one backend session, so a side question about chat A never sees chat B's history.
// The id comes from the chat's address, so it is the same after Chrome restarts the service worker. Two tabs on a
// brand-new chat (no chat id in the address yet) are told apart by the tab id.
import { describe, it, expect } from "vitest";
import { sessionIdFor } from "../background/sessionId.js";
import { SESSION_ID_PATTERN } from "../shared/constants.js";

describe("sessionIdFor: a chat with its own id", () => {
  it.each([
    ["/app/7aef0c969e3d2551", "g-7aef0c969e3d2551"],
    ["/app/7aef0c969e3d2551/", "g-7aef0c969e3d2551"],
    ["/u/1/app/abc123", "g-abc123"],
    ["/gem/storybook/abc123", "g-abc123"],
    ["/app/abc123?hl=en#top", "g-abc123"],
  ])("%s -> %s", (path, expected) => {
    expect(sessionIdFor(path, 7)).toBe(expected);
  });

  it("is the same for every tab (the chat, not the tab, is the session)", () => {
    expect(sessionIdFor("/app/abc123", 1)).toBe(sessionIdFor("/app/abc123", 2));
    expect(sessionIdFor("/app/abc123")).toBe("g-abc123");
  });

  it("differs for different chats", () => {
    expect(sessionIdFor("/app/aaa")).not.toBe(sessionIdFor("/app/bbb"));
  });

  it("replaces characters the backend would refuse, so the id is always valid", () => {
    const id = sessionIdFor("/app/ab c%20d.é");

    expect(id).toBe("g-ab-c-20d--");
    expect(id).toMatch(SESSION_ID_PATTERN);
  });

  it("never exceeds 64 characters (boundary: 62-character chat id fits, 63+ is cut)", () => {
    expect(sessionIdFor(`/app/${"a".repeat(62)}`)).toHaveLength(64);
    expect(sessionIdFor(`/app/${"a".repeat(63)}`)).toHaveLength(64);
    expect(sessionIdFor(`/app/${"a".repeat(500)}`)).toMatch(SESSION_ID_PATTERN);
  });
});

describe("sessionIdFor: a brand-new chat (no chat id in the address yet)", () => {
  it("is separate per tab", () => {
    expect(sessionIdFor("/app", 7)).toBe("g-new-7");
    expect(sessionIdFor("/app", 8)).toBe("g-new-8");
  });

  it.each(["/app", "/app/", "/", "", "/u/2/app", undefined, null])("%j is a new chat", (path) => {
    expect(sessionIdFor(path, 3)).toBe("g-new-3");
  });

  it.each([undefined, null, -1, 1.5, NaN, "7", {}])("falls back to the shared 'g-new' when the tab id is %j", (tabId) => {
    expect(sessionIdFor("/app", tabId)).toBe("g-new");
  });

  it("accepts tab id 0 and a very large tab id, and stays valid", () => {
    expect(sessionIdFor("/app", 0)).toBe("g-new-0");
    expect(sessionIdFor("/app", Number.MAX_SAFE_INTEGER)).toMatch(SESSION_ID_PATTERN);
  });
});
