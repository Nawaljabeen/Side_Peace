// Content script logic (REQ-F01, REQ-F02): watch the Gemini chat with DOMObserver and relay each finished
// turn to the service worker. content.js loads this module with a dynamic import, because a classic
// content script cannot use static imports.
import { DOMObserver } from "./domObserver.js";
import { startRelay } from "./relay.js";

/**
 * @param {object} deps
 * @param {Document} deps.document
 * @param {{sendMessage: (message: object) => Promise<object>}} deps.runtime  chrome.runtime
 * @param {{pathname: string}} deps.location
 * @returns {() => void} stop function
 */
export function startContentScript({ document, runtime, location }) {
  const observer = new DOMObserver(document.body);
  const stopRelay = startRelay({
    observer,
    sendMessage: (message) => runtime.sendMessage(message),
    getPathname: () => location.pathname,
  });
  observer.startObserving(); // reports the turns already on the page, then every change once it settles
  return () => {
    observer.stopObserving();
    stopRelay();
  };
}
