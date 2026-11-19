
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TextDebouncer } from "../content/textDebouncer.js";

describe("TextDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers(); 
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once with only the final text after the stream goes quiet", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(300, callback);

    debouncer.debounce("He");
    debouncer.debounce("Hel");
    debouncer.debounce("Hello");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("Hello");
  });

  it("restarts the wait on every new chunk", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(300, callback);

    debouncer.debounce("a");
    vi.advanceTimersByTime(299);
    debouncer.debounce("ab");
    vi.advanceTimersByTime(299);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("ab");
  });

  it("fires again for a second burst after the first has settled", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(100, callback);

    debouncer.debounce("first");
    vi.advanceTimersByTime(100);
    debouncer.debounce("second");
    vi.advanceTimersByTime(100);

    expect(callback.mock.calls).toEqual([["first"], ["second"]]);
  });

  it("flush() delivers the pending value immediately, exactly once", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(300, callback);

    debouncer.debounce("pending");
    debouncer.flush();
    vi.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("pending");
  });

  it("flush() with nothing pending does nothing", () => {
    const callback = vi.fn();
    new TextDebouncer(300, callback).flush();
    expect(callback).not.toHaveBeenCalled();
  });

  it("cancel() drops the pending value", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(300, callback);

    debouncer.debounce("dropped");
    debouncer.cancel();
    vi.advanceTimersByTime(300);

    expect(callback).not.toHaveBeenCalled();
  });

  it("cancel() with nothing pending is safe", () => {
    const debouncer = new TextDebouncer(300, vi.fn());
    expect(() => debouncer.cancel()).not.toThrow();
    expect(debouncer.isPending).toBe(false);
  });

  it("isPending reports whether a value is waiting", () => {
    const debouncer = new TextDebouncer(300, vi.fn());
    expect(debouncer.isPending).toBe(false);
    debouncer.debounce("x");
    expect(debouncer.isPending).toBe(true);
    vi.advanceTimersByTime(300);
    expect(debouncer.isPending).toBe(false);
  });

  it("accepts a delay of 0 (fires on the next timer tick)", () => {
    const callback = vi.fn();
    const debouncer = new TextDebouncer(0, callback);
    debouncer.debounce("now");
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledWith("now");
  });

  // Defensive programming: reject bad configuration at construction time.
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects delayMs %s with RangeError",
    (bad) => {
      expect(() => new TextDebouncer(bad, vi.fn())).toThrow(RangeError);
    },
  );

  it.each(["300", null, undefined])("rejects non-number delayMs %s with TypeError", (bad) => {
    expect(() => new TextDebouncer(bad, vi.fn())).toThrow(TypeError);
  });

  it("rejects a callback that is not a function with TypeError", () => {
    expect(() => new TextDebouncer(300, "not a function")).toThrow(TypeError);
  });
});