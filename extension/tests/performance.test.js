// QR-01: the DOM engine must never freeze the page. Every handler run must finish
// in under 50 ms. These tests pass on first run: the design (a handler that only
// restarts a timer, one parse per settled stream) already meets the budget, so
// they are committed as a verification, not as a red test.
//
// Note: timings come from jsdom in Node, not from Chrome. The manual end-to-end
// run on real Gemini (Card 3) is the browser-side check.
import { describe, it, expect } from "vitest";
import { DOMObserver } from "../content/domObserver.js";
import { parseTurns } from "../content/turnParser.js";
import { loadFixture } from "./helpers/fixtures.js";

const BUDGET_MS = 50;

function timeIt(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe("DOM engine performance (QR-01)", () => {
  it("handles each of 1000 mutation events in under 50 ms", () => {
    document.body.innerHTML = loadFixture("gemini-conversation.html");
    let trigger;
    const observer = new DOMObserver(document.body, {
      createMutationObserver: (callback) => {
        trigger = callback;
        return { observe() {}, disconnect() {} };
      },
    });
    observer.startObserving();

    const timings = [];
    for (let i = 0; i < 1000; i += 1) {
      timings.push(timeIt(() => trigger([])));
    }
    observer.stopObserving();

    expect(timings).toHaveLength(1000);
    expect(Math.max(...timings)).toBeLessThan(BUDGET_MS);
  });

  it("parses a 200-turn chat in under 50 ms", () => {
    // 50 copies of the 2-exchange fixture = 100 exchanges = 200 turns
    document.body.innerHTML = loadFixture("gemini-conversation.html").repeat(50);
    expect(parseTurns(document.body)).toHaveLength(200); // also warms up the JIT

    const timings = Array.from({ length: 5 }, () => timeIt(() => parseTurns(document.body)));

    expect(Math.max(...timings)).toBeLessThan(BUDGET_MS);
  });
});
