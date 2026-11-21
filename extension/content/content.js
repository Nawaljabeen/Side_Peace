// Content script entry point (runs on gemini.google.com only, see manifest.json). It only loads the real
// code, which lives in contentScript.js and is tested there. The modules are listed under
// web_accessible_resources for the same single host.
(async () => {
  try {
    const { startContentScript } = await import(chrome.runtime.getURL("content/contentScript.js"));
    startContentScript({ document, runtime: chrome.runtime, location: window.location });
  } catch (error) {
    console.error("SidePeace: the content script could not start", error);
  }
})();
