// Wiring of the service worker (REQ-F02, R-05). Kept apart from service_worker.js so it can be tested with a
// fake `chrome` object.
import { toErrorPayload } from "../shared/errors.js";
import { ExtensionBridge } from "./extensionBridge.js";
import { createMessageHandler } from "./messageHandler.js";

const GEMINI_HOST = "gemini.google.com";

/**
 * The Gemini chat the user is looking at: its address path and the tab id, or null when the active tab is not a
 * Gemini page. Only the host permission for Gemini is needed to read the address (QR-03: nothing extra asked).
 */
export async function getActiveConversation(chromeApi) {
  try {
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number" || typeof tab.url !== "string") {
      return null;
    }
    const url = new URL(tab.url);
    return url.protocol === "https:" && url.hostname === GEMINI_HOST ? { path: url.pathname, tabId: tab.id } : null;
  } catch {
    return null;
  }
}

/** Connect the handler to chrome.runtime.onMessage. The listener answers asynchronously, so it returns true. */
export function registerMessageListener(chromeApi, handler) {
  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handler(message, sender)
      .catch((error) => ({ ok: false, error: toErrorPayload(error) }))
      .then((reply) => {
        try {
          sendResponse(reply);
        } catch {
          // The sender went away (for example the panel was closed) before the answer was ready.
        }
      });
    return true;
  });
}

/**
 * Everything the service worker does. It must run when the worker's code first runs and register the message
 * listener BEFORE anything asynchronous: Chrome stops an idle worker and restarts it with the next message, and
 * a listener added later would miss that message (R-05).
 */
export function setupServiceWorker(chromeApi, { bridge = new ExtensionBridge() } = {}) {
  const handler = createMessageHandler({
    bridge,
    getActiveConversation: () => getActiveConversation(chromeApi),
    ownExtensionId: chromeApi.runtime.id,
  });
  registerMessageListener(chromeApi, handler);

  chromeApi.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("SidePeace: could not set side panel behaviour", error));
}
