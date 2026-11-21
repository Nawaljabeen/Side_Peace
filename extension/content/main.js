/**
 * Start-up of the content script (REQ-F01, REQ-F02). Loaded by content.js with a dynamic import (DEC-23),
 * because Chrome runs content scripts as classic scripts and this code uses ES modules.
 *
 * It connects the pieces: DOMObserver (reads the page) -> TurnRelay (Observer, sends turns) ->
 * chrome.runtime.sendMessage -> service worker -> ExtensionBridge -> backend. The chrome and window objects
 * are parameters so a test can pass fakes.
 */
import { DOMObserver } from "./domObserver.js";
import { TurnRelay } from "./turnRelay.js";

const GEMINI_HOSTNAME = "gemini.google.com";
const NAVIGATION_EVENT = "navigatesuccess";

/**
 * @returns {() => void} a function that stops everything again
 */
export function startContent({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  chromeApi = globalThis.chrome,
  debounceMs,
} = {}) {
  // The manifest already limits where this script runs; this is a second lock (QR-03).
  if (win.location.hostname !== GEMINI_HOSTNAME) {
    return () => {};
  }

  const observer = new DOMObserver(doc.body, debounceMs === undefined ? {} : { debounceMs });
  const relay = new TurnRelay({
    observer,
    sendMessage: (message) => chromeApi.runtime.sendMessage(message),
    getPath: () => win.location.pathname,
  });
  const onNavigate = () => relay.checkPath();

  relay.start();
  win.navigation?.addEventListener(NAVIGATION_EVENT, onNavigate);
  observer.startObserving();

  return () => {
    observer.stopObserving();
    win.navigation?.removeEventListener(NAVIGATION_EVENT, onNavigate);
    relay.stop();
  };
}
