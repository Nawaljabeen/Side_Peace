// Relay (REQ-F01, REQ-F02): sends every finished turn that DOMObserver reports to the service worker, which
// owns the only connection to the backend. It also notices when Gemini (a single-page app) moves to another
// chat and asks the observer to report that chat again from turn 0 (the bridge sends each turn only once).

/**
 * @param {object} options
 * @param {{subscribe: Function, reset: Function, scan: Function}} options.observer  a DOMObserver
 * @param {(message: object) => Promise<object>} options.sendMessage  chrome.runtime.sendMessage
 * @param {() => string} options.getPathname  location.pathname of the Gemini tab
 * @param {number} [options.pollMs]  how often to look for a changed address
 * @returns {() => void} stop function
 */
export function startRelay({ observer, sendMessage, getPathname, pollMs = 1000 }) {
  let lastPath = getPathname();

  function report(problem) {
    console.warn("SidePeace: could not relay a turn", problem);
  }

  const unsubscribe = observer.subscribe((turn) => {
    const message = {
      type: "sync-turn",
      conversationPath: getPathname(),
      turn: { index: turn.index, role: turn.role, text: turn.text },
    };
    try {
      Promise.resolve(sendMessage(message))
        .then((response) => {
          if (!response?.ok) {
            report(response?.error?.name ?? "refused");
          }
        })
        .catch((error) => report(error?.message ?? error));
    } catch (error) {
      report(error?.message ?? error); // e.g. "Extension context invalidated" after an extension update
    }
  });

  const timer = setInterval(() => {
    const current = getPathname();
    if (current !== lastPath) {
      lastPath = current;
      observer.reset();
      observer.scan();
    }
  }, pollMs);

  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
