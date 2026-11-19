import { SidePanelController } from "./sidePanelController.js";
import { checkServer } from "./serverStatus.js";

export function initSidePanel({ document, bridge, backendUrl, fetchFn }) {
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

  const serverStatus = document.getElementById("server-status");
  const ready = checkServer(backendUrl, fetchFn).then((isUp) => {
    serverStatus.dataset.state = isUp ? "up" : "down";
    serverStatus.textContent = isUp ? "Server: connected" : "Server: not running (demo answers only)";
  });
  return { controller, ready };
}
