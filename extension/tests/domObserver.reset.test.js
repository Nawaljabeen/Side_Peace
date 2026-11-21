// REQ-F01: Gemini is a single-page app, so one DOMObserver lives across several chats.
// When the page shows a different conversation, every turn must be reported again so the
// new session receives it from turn 0 (found by review: turn 0 was silently skipped).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DOMObserver } from "../content/domObserver.js";

const userTurn = (text) => `<user-query><p class="query-text-line">${text}</p></user-query>`;
const modelTurn = (text) => `<model-response><message-content><div class="markdown"><p>${text}</p></div></message-content></model-response>`;
const chat = (turns) => turns.map(([role, text]) => (role === "user" ? userTurn(text) : modelTurn(text))).join("");

describe("DOMObserver reset (REQ-F01)", () => {
  let root;
  let listener;
  let observer;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chat"></div>';
    root = document.getElementById("chat");
    listener = vi.fn();
    observer = new DOMObserver(root);
    observer.subscribe(listener);
  });

  const reported = () => listener.mock.calls.map(([turn]) => `${turn.index}:${turn.role}:${turn.text}`);

  it("reset() makes the next scan report every turn again", () => {
    root.innerHTML = chat([["user", "hello"], ["model", "hi there"]]);
    observer.scan();
    listener.mockClear();

    observer.reset();
    observer.scan();

    expect(reported()).toEqual(["0:user:hello", "1:model:hi there"]);
  });
});
