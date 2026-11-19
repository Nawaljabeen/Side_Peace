import { SidePanelController } from "./sidePanelController.js";

export function initSidePanel({ document, bridge }) {
  const controller = new SidePanelController(bridge, {
    input: document.getElementById("query"),
    submitButton: document.getElementById("submit"),
    messageArea: document.getElementById("message"),
    answerArea: document.getElementById("answer"),
  });
  document.getElementById("query-form").addEventListener("submit", (event) => {
    event.preventDefault();
    controller.handleUserSubmit();
  });
  return { controller, ready: Promise.resolve() };
}
