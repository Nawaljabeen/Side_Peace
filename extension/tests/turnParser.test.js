// REQ-F01: the DOM engine turns the Gemini chat page into contract-shaped turns.
// The page comes from a saved fixture, so the test runs against real Gemini markup.
import { describe, it, expect, beforeEach } from "vitest";
import { parseTurns } from "../content/turnParser.js";
import { loadContractExample, mountFixture } from "./helpers/fixtures.js";

describe("parseTurns (real Gemini markup)", () => {
  let root;

  beforeEach(() => {
    root = mountFixture("gemini-conversation.html");
  });

  it("returns user and model turns in page order, indexed from 0", () => {
    const turns = parseTurns(root);
    expect(turns.map(({ index, role }) => [index, role])).toEqual([
      [0, "user"],
      [1, "model"],
      [2, "user"],
      [3, "model"],
    ]);
  });

  it("reads the question once, not the hidden 'You said' label", () => {
    const turns = parseTurns(root);
    expect(turns[0].text).toBe("Explain how a debouncer works in two sentences.");
    expect(turns[2].text).toBe("What does clearTimeout do?");
  });

  it("reads the answer without Gemini's labels, code header or disclaimer", () => {
    const answer = parseTurns(root)[1].text;
    expect(answer).toContain("A debouncer waits until calls stop arriving");
    expect(answer).not.toContain("Gemini said");
    expect(answer).not.toContain("JavaScript"); // the code block's language label
    expect(answer).not.toContain("can make mistakes"); // the footer disclaimer
  });

  it("keeps paragraphs, headings and code lines on separate lines", () => {
    const lines = parseTurns(root)[1]
      .text.split("\n")
      .filter((line) => line.trim() !== "");
    expect(lines.slice(0, 3)).toEqual([
      "A debouncer waits until calls stop arriving, then runs the callback once with the latest value.",
      "Example (debounce.js)",
      "function debounce(fn, ms) {",
    ]);
  });

  it("puts each list item on its own line", () => {
    const lines = parseTurns(root)[3]
      .text.split("\n")
      .filter((line) => line.trim() !== "");
    expect(lines).toEqual([
      "It cancels a timer created earlier with setTimeout, so the callback never runs.",
      "Pass the id returned by setTimeout.",
      "Calling it with an unknown id does nothing.",
    ]);
  });

  it("returns exactly the fields of the API contract turn", () => {
    const contractKeys = Object.keys(loadContractExample("sync-request.json").turn).sort();
    for (const turn of parseTurns(root)) {
      expect(Object.keys(turn).sort()).toEqual(contractKeys);
    }
  });

  it("never modifies the host page (REQ-F01)", () => {
    const before = root.innerHTML;
    parseTurns(root);
    expect(root.innerHTML).toBe(before);
  });
});
