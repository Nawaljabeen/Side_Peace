// Entry point of the content script (manifest.json). Chrome runs content scripts as classic scripts, which
// cannot use import/export, so this file stays tiny: it loads the real code, which is made of ES modules, with
// a dynamic import() of a web-accessible file and starts it (DEC-23). The files that may be imported are the
// ones listed under web_accessible_resources in manifest.json, and only Gemini pages may load them.
(async () => {
  try {
    const { startContent } = await import(/* @vite-ignore */ chrome.runtime.getURL("content/main.js"));
    startContent();
  } catch (error) {
    // Nothing may escape to the Gemini page, for example when the extension was reloaded under an open tab.
    console.error("SidePeace: could not start the content script", error?.name);
  }
})();
