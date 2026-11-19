import { SidePanelController } from "./sidePanelController.js";

// Temporary stand-in until Nawal's ExtensionBridge is merged: it only has to
// expose sendQuery(text) -> Promise<string>.
// Demo-only failure trigger for the black-box UI script: open sidepanel.html?demo=fail, or ask a
// question containing "simulate failure". Removed when the real ExtensionBridge is wired in.
const failByUrl = new URLSearchParams(location.search).get("demo") === "fail";
const fakeBridge = {
  sendQuery: (text) =>
    new Promise((resolve, reject) =>
      setTimeout(
        () =>
          failByUrl || text.toLowerCase().includes("simulate failure")
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
