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

describe("SidePanelController valid submit (REQ-F04)", () => {
  it("calls the bridge once, disables the button while loading and shows the answer", async () => {
    const pending = deferred();
    bridge.sendQuery.mockReturnValue(pending.promise);
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "  what is a mutex?  ";

    const submission = controller.handleUserSubmit();
    expect(bridge.sendQuery).toHaveBeenCalledTimes(1);
    expect(bridge.sendQuery).toHaveBeenCalledWith("what is a mutex?");
    expect(elements.submitButton.disabled).toBe(true);

    pending.resolve("a lock");
    await submission;
    expect(elements.answerArea.textContent).toBe("a lock");
    expect(elements.submitButton.disabled).toBe(false);
  });
});

describe("SidePanelController output safety (REQ-F04)", () => {
  it("renders answers as text, never as HTML", () => {
    const controller = new SidePanelController(bridge, elements);
    controller.renderResponse("<img src=x onerror=alert(1)>");
    expect(elements.answerArea.querySelector("img")).toBeNull();
    expect(elements.answerArea.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("renders error messages as text, never as HTML", () => {
    const controller = new SidePanelController(bridge, elements);
    controller.renderError("<b>bold</b>");
    expect(elements.messageArea.querySelector("b")).toBeNull();
  });
});

describe("SidePanelController failure handling (REQ-F04, REQ-Q02)", () => {
  it("shows a friendly message when the bridge rejects and does not throw", async () => {
    bridge.sendQuery.mockRejectedValue(new TypeError("Failed to fetch"));
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "hello";
    await expect(controller.handleUserSubmit()).resolves.toBeUndefined();
    expect(elements.messageArea.textContent).toMatch(/could not reach/i);
    expect(elements.messageArea.textContent).not.toMatch(/failed to fetch/i);
    expect(elements.submitButton.disabled).toBe(false);
  });
});

describe("SidePanelController stale responses (REQ-F04)", () => {
  it("shows only the latest answer when an older reply arrives last", async () => {
    const first = deferred();
    const second = deferred();
    bridge.sendQuery.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const controller = new SidePanelController(bridge, elements);

    elements.input.value = "first question";
    const firstSubmission = controller.handleUserSubmit();
    elements.input.value = "second question";
    const secondSubmission = controller.handleUserSubmit();

    second.resolve("second answer");
    await secondSubmission;
    first.resolve("first answer");
    await firstSubmission;

    expect(elements.answerArea.textContent).toBe("second answer");
  });
});

describe("SidePanelController clears old answers (REQ-F04)", () => {
  it("removes the previous answer when a new question fails", async () => {
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "first";
    await controller.handleUserSubmit();
    expect(elements.answerArea.textContent).toBe("canned answer");

    bridge.sendQuery.mockRejectedValue(new TypeError("Failed to fetch"));
    elements.input.value = "second";
    await controller.handleUserSubmit();
    expect(elements.answerArea.textContent).toBe("");
    expect(elements.messageArea.textContent).toMatch(/could not reach/i);
  });
});

describe("SidePanelController clears the answer on every submit (REQ-F04)", () => {
  it("removes the previous answer when the next input is empty", async () => {
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "first";
    await controller.handleUserSubmit();
    expect(elements.answerArea.textContent).toBe("canned answer");

    elements.input.value = "   ";
    await controller.handleUserSubmit();
    expect(elements.answerArea.textContent).toBe("");
    expect(elements.messageArea.textContent).toMatch(/type a question/i);
  });

  it("removes the previous answer when the next input is too long", async () => {
    const controller = new SidePanelController(bridge, elements);
    elements.input.value = "first";
    await controller.handleUserSubmit();

    elements.input.value = "x".repeat(MAX_QUERY_LENGTH + 1);
    await controller.handleUserSubmit();
    expect(elements.answerArea.textContent).toBe("");
    expect(elements.messageArea.textContent).toMatch(/too long/i);
  });
});

describe("SidePanelController ignores a pending reply after a rejected submit (REQ-F04)", () => {
  it("does not show a late answer once an empty submit has cleared the panel", async () => {
    const pending = deferred();
    bridge.sendQuery.mockReturnValue(pending.promise);
    const controller = new SidePanelController(bridge, elements);

    elements.input.value = "slow question";
    const firstSubmission = controller.handleUserSubmit();

    elements.input.value = "";
    await controller.handleUserSubmit();

    pending.resolve("late answer");
    await firstSubmission;

    expect(elements.answerArea.textContent).toBe("");
    expect(elements.messageArea.textContent).toMatch(/type a question/i);
  });
});
