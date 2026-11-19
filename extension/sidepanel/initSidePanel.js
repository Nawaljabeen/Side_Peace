import { SidePanelController } from "./sidePanelController.js";
import { checkServer } from "./serverStatus.js";

function requireElement(document, id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`SidePeace panel: element #${id} is missing from sidepanel.html`);
  }
  return element;
}

export function initSidePanel({ document, bridge, backendUrl, fetchFn }) {
  const controller = new SidePanelController(bridge, {
    input: requireElement(document, "query"),
    submitButton: requireElement(document, "submit"),
    messageArea: requireElement(document, "message"),
    answerArea: requireElement(document, "answer"),
  });
  requireElement(document, "query-form").addEventListener("submit", (event) => {
    event.preventDefault();
    controller.handleUserSubmit();
  });

  const serverStatus = requireElement(document, "server-status");
  const ready = checkServer(backendUrl, fetchFn).then((isUp) => {
    serverStatus.dataset.state = isUp ? "up" : "down";
    serverStatus.textContent = isUp ? "Server: connected" : "Server: not running (demo answers only)";
  });
  return { controller, ready };
}
