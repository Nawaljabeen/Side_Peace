// Service worker entry point. All logic lives in serviceWorkerSetup.js and extensionBridge.js (tested).
import { setUpServiceWorker } from "./serviceWorkerSetup.js";

setUpServiceWorker(chrome);
