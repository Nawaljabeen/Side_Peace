import { initSidePanel } from "./initSidePanel.js";
import { BACKEND_URL } from "../shared/constants.js";

// Temporary stand-in until Nawal's ExtensionBridge is merged: it only has to
// expose sendQuery(text) -> Promise<string>.
// Demo-only failure trigger for the black-box UI script: open sidepanel.html?demo=fail, or ask a
// question containing "simulate failure". Removed when the real ExtensionBridge is wired in.
const failByUrl = new URLSearchParams(location.search).get("demo") === "fail";
const fakeBridge = {
  sendQuery: (text) =>
    new Promise((resolve, reject) =>
      setTimeout(
        () =>
          failByUrl || text.toLowerCase().includes("simulate failure")
            ? reject(new TypeError("Failed to fetch"))
            : resolve(`(demo answer) You asked: ${text}`),
        600,
      ),
    ),
};

initSidePanel({ document, bridge: fakeBridge, backendUrl: BACKEND_URL, fetchFn: fetch.bind(globalThis) });
