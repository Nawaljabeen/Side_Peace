// R-01 (Gemini changes its DOM) and REQ-Q01 (resilience): the parser must degrade
// gracefully instead of throwing, and must respect the API contract limits.
import { describe, it, expect } from "vitest";
import { parseTurns } from "../content/turnParser.js";
import { GEMINI_SELECTORS } from "../content/selectors.js";
import { MAX_TURN_TEXT_LENGTH } from "../shared/constants.js";
import { mountFixture } from "./helpers/fixtures.js";

// Smallest page that has one question and one answer in Gemini's structure.
const page = (answerHtml) => `
  <user-query><p class="query-text-line">Hi</p></user-query>
  <model-response><message-content><div class="markdown">${answerHtml}</div></message-content></model-response>`;

describe("parseTurns: missing or empty input", () => {
  it.each([null, undefined, {}, "not a node"])("returns [] for root %s", (root) => {
    expect(parseTurns(root)).toEqual([]);
  });

  it("returns [] when the page has no chat yet", () => {
    document.body.innerHTML = "<main><p>Welcome</p></main>";
    expect(parseTurns(document.body)).toEqual([]);
  });

  it("skips an answer that has no text yet (streaming just started)", () => {
    document.body.innerHTML = page("");
    expect(parseTurns(document.body)).toEqual([{ index: 0, role: "user", text: "Hi" }]);
  });
});

describe("parseTurns: Gemini changed its page structure (R-01)", () => {
  it("fixture check: the primary selectors really find nothing", () => {
    const root = mountFixture("gemini-changed-structure.html");
    expect(root.querySelector(GEMINI_SELECTORS.user.turn[0])).toBeNull();
    expect(root.querySelector(GEMINI_SELECTORS.model.turn[0])).toBeNull();
  });

  it("falls back to the secondary selectors and returns the same turns", () => {
    const original = parseTurns(mountFixture("gemini-conversation.html"));
    const root = mountFixture("gemini-changed-structure.html");
    expect(parseTurns(root)).toEqual(original);
  });

  it("skips a selector the browser rejects and uses the next one", () => {
    document.body.innerHTML = page("Hello");
    const selectors = {
      user: { turn: ["::not-a-selector(", "user-query"], text: [".query-text-line"] },
      model: { turn: ["model-response"], text: ["message-content .markdown"] },
      ignore: ".cdk-visually-hidden",
    };
    expect(parseTurns(document.body, selectors).map((turn) => turn.role)).toEqual(["user", "model"]);
  });
});

describe("parseTurns: API contract limits", () => {
  it("keeps at most MAX_TURN_TEXT_LENGTH characters (turn.text is 1-20000)", () => {
    document.body.innerHTML = page("x".repeat(MAX_TURN_TEXT_LENGTH + 50));
    const [, answer] = parseTurns(document.body);
    expect(answer.text).toHaveLength(MAX_TURN_TEXT_LENGTH);
  });

  it("MAX_TURN_TEXT_LENGTH matches docs/api-contract.md (20000)", () => {
    expect(MAX_TURN_TEXT_LENGTH).toBe(20000);
  });
});
