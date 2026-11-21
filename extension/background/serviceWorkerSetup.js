// Wires the pieces together inside the service worker (kept separate from service_worker.js so it can
// be tested with a fake chrome object). Chrome starts the worker when a message arrives, which is also
// how the side panel wakes it up when it opens (R-05): the panel sends a "health" message first.
import { ExtensionBridge } from "./extensionBridge.js";
import { createMessageHandler } from "./messageHandler.js";

const GEMINI_HOST = "gemini.google.com";

/** Path of the Gemini chat in the active tab (e.g. "/app/7aef..."), or "" when the user is not on Gemini. */
export async function getActiveConversationPath(chromeApi) {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return "";
  }
  try {
    const url = new URL(tab.url);
    return url.hostname === GEMINI_HOST ? url.pathname : "";
  } catch {
    return "";
  }
}

/**
 * @param {typeof chrome} chromeApi
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]  injected in tests
 * @param {string} [options.baseUrl]
 */
export function setUpServiceWorker(chromeApi, { fetchFn, baseUrl } = {}) {
  chromeApi.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("SidePeace: could not set side panel behaviour", error));

  const bridge = new ExtensionBridge({ baseUrl, fetchFn });
  const handle = createMessageHandler({
    bridge,
    getActiveConversationPath: () => getActiveConversationPath(chromeApi),
    ownExtensionId: chromeApi.runtime.id,
  });

  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handle(message, sender).then(sendResponse);
    return true; // the answer is sent later, so keep the message channel open
  });
  return { bridge, handle };
}
