import { initSidePanel } from "./initSidePanel.js";
import { createRuntimeBridge } from "./runtimeBridge.js";

// The panel only talks to the service worker (ExtensionBridge) through chrome.runtime messages.
initSidePanel({ document, bridge: createRuntimeBridge(chrome.runtime) });
