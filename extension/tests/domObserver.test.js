// REQ-F01 + Observer pattern: DOMObserver is the Subject. It owns the subscriber list,
// notifies each subscriber once per new or changed turn, and isolates failures.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DOMObserver } from "../content/domObserver.js";
import { mountFixture } from "./helpers/fixtures.js";

describe("DOMObserver subscribers", () => {
  let root;

  beforeEach(() => {
    root = mountFixture("gemini-conversation.html");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([null, undefined, {}, "chat"])("rejects root %s with TypeError", (bad) => {
    expect(() => new DOMObserver(bad)).toThrow(TypeError);
  });

  it("rejects a subscriber that is not a function", () => {
    const observer = new DOMObserver(root);
    expect(() => observer.subscribe("nope")).toThrow(TypeError);
  });

  it("notifies a subscriber once per turn, in page order", () => {
    const observer = new DOMObserver(root);
    const listener = vi.fn();
    observer.subscribe(listener);

    observer.scan();

    expect(listener.mock.calls.map(([turn]) => [turn.index, turn.role])).toEqual([
      [0, "user"],
      [1, "model"],
      [2, "user"],
      [3, "model"],
    ]);
  });

  it("does not notify again when nothing changed", () => {
    const observer = new DOMObserver(root);
    const listener = vi.fn();
    observer.subscribe(listener);

    observer.scan();
    observer.scan();

    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("notifies only the turn whose text changed", () => {
    const observer = new DOMObserver(root);
    const listener = vi.fn();
    observer.subscribe(listener);
    observer.scan();
    listener.mockClear();

    root.querySelectorAll(".markdown")[1].append(" Extra words.");
    observer.scan();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ index: 3, role: "model" });
    expect(listener.mock.calls[0][0].text).toContain("Extra words.");
  });

  it("stops notifying after unsubscribe", () => {
    const observer = new DOMObserver(root);
    const listener = vi.fn();
    const unsubscribe = observer.subscribe(listener);

    unsubscribe();
    observer.scan();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every subscriber even if one throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const observer = new DOMObserver(root);
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    observer.subscribe(failing);
    observer.subscribe(healthy);

    expect(() => observer.scan()).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalled();
  });

  it("parseLatestTurn returns the newest turn", () => {
    const observer = new DOMObserver(root);
    expect(observer.parseLatestTurn()).toMatchObject({ index: 3, role: "model" });
  });

  it("parseLatestTurn returns null when the page has no chat", () => {
    document.body.innerHTML = "<main></main>";
    expect(new DOMObserver(document.body).parseLatestTurn()).toBeNull();
  });

  it("only reads the page (REQ-F01)", () => {
    const observer = new DOMObserver(root);
    observer.subscribe(() => {});
    const before = root.innerHTML;

    observer.scan();
    observer.parseLatestTurn();

    expect(root.innerHTML).toBe(before);
  });
});
