// Wiring of the service worker (REQ-F02, R-05). Kept apart from service_worker.js so it can be tested with a
// fake `chrome` object.
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
