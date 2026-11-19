import { SidePanelController } from "./sidePanelController.js";

// Temporary stand-in until Nawal's ExtensionBridge is merged: it only has to
// expose sendQuery(text) -> Promise<string>.
// Open sidepanel.html?demo=fail to simulate a network failure (used by the black-box UI script).
const simulateFailure = new URLSearchParams(location.search).get("demo") === "fail";
const fakeBridge = {
  sendQuery: (text) =>
    new Promise((resolve, reject) =>
      setTimeout(
        () =>
          simulateFailure
            ? reject(new TypeError("Failed to fetch"))
            : resolve(`(demo answer) You asked: ${text}`),
        600,
      ),
    ),
};

const controller = new SidePanelController(fakeBridge, {
  input: document.getElementById("query"),
  submitButton: document.getElementById("submit"),
  messageArea: document.getElementById("message"),
  answerArea: document.getElementById("answer"),
});

document.getElementById("query-form").addEventListener("submit", (event) => {
  event.preventDefault();
  controller.handleUserSubmit();
});
