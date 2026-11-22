import { SidePanelController } from "./sidePanelController.js";

function requireElement(document, id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`SidePeace panel: element #${id} is missing from sidepanel.html`);
  }
  return element;
}

/**
 * @param {object} deps
 * @param {Document} deps.document
 * @param {{sendQuery: (text: string) => Promise<string>, checkHealth: () => Promise<boolean>}} deps.bridge
 */
export function initSidePanel({ document, bridge }) {
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
  const ready = Promise.resolve()
    .then(() => bridge.checkHealth())
    .catch(() => false)
    .then((isUp) => {
      serverStatus.dataset.state = isUp ? "up" : "down";
      serverStatus.textContent = isUp ? "Server: connected" : "Server: not running (answers need the backend)";
    });
  return { controller, ready };
}
