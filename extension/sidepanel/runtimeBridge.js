// The side panel's bridge (REQ-F04, REQ-Q02). The panel never calls the backend itself: it sends
// chrome.runtime messages to the service worker, where the ExtensionBridge is the only code that
// does HTTP (DEC-09). This object has the shape SidePanelController expects: sendQuery(text).
import { NetworkError, ServerError, fromErrorPayload } from "../shared/errors.js";

/** @param {{sendMessage: (message: object) => Promise<object>}} runtime  chrome.runtime */
export function createRuntimeBridge(runtime) {
  async function ask(message) {
    try {
      return await runtime.sendMessage(message);
    } catch {
      throw new NetworkError("The SidePeace extension is not responding."); // e.g. the worker could not start
    }
  }

  return {
    /** Ask a side question; resolves to the answer text or throws a typed error. */
    async sendQuery(text) {
      const response = await ask({ type: "query", text });
      if (!response) {
        throw new NetworkError("The SidePeace extension did not answer.");
      }
      if (!response.ok) {
        throw fromErrorPayload(response.error);
      }
      if (typeof response.answer !== "string" || response.answer === "") {
        throw new ServerError("The server answered without any text.");
      }
      return response.answer;
    },

    /** True when the backend is healthy. Sending this message also wakes the service worker (R-05). */
    async checkHealth() {
      try {
        const response = await runtime.sendMessage({ type: "health" });
        return response?.ok === true && response.healthy === true;
      } catch {
        return false;
      }
    },
  };
}
