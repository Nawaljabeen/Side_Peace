// Entry point of the service worker (manifest.json). Chrome runs this file every time it starts the worker, so
// the setup must happen here, at the top level, at once (R-05). All logic lives in serviceWorkerSetup.js.
import { setupServiceWorker } from "./serviceWorkerSetup.js";

setupServiceWorker(chrome);
