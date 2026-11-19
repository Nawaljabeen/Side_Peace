// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidePanelController } from "../sidepanel/sidePanelController.js";
import { MAX_QUERY_LENGTH } from "../shared/constants.js";

let elements;
let bridge;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  document.body.innerHTML = `
    <textarea id="query"></textarea>
    <button id="submit">Ask</button>
    <div id="message"></div>
    <div id="answer"></div>`;
  elements = {
    input: document.getElementById("query"),
    submitButton: document.getElementById("submit"),
    messageArea: document.getElementById("message"),
    answerArea: document.getElementById("answer"),
  };
  bridge = { sendQuery: vi.fn().mockResolvedValue("canned answer") };
});

describe("SidePanelController input validation (REQ-F04)", () => {
  it("shows an inline message and skips the bridge for empty input", async () => {
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "   ";
    await controller.handleUserSubmit();
    expect(bridge.sendQuery).not.toHaveBeenCalled();
    expect(elements.messageArea.textContent).toMatch(/type a question/i);
  });
});

describe("SidePanelController length limit (REQ-F04)", () => {
  it("rejects input longer than the limit without calling the bridge", async () => {
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "x".repeat(MAX_QUERY_LENGTH + 1);
    await controller.handleUserSubmit();
    expect(bridge.sendQuery).not.toHaveBeenCalled();
    expect(elements.messageArea.textContent).toMatch(/too long/i);
  });
});
