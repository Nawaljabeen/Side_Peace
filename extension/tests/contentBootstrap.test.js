// DEC-23: content.js is a classic script (Chrome cannot load a content script as a module), so it loads the real
// code with a dynamic import() of a web-accessible file and starts it. Nothing may escape to the Gemini page.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const FAKE_MAIN = pathToFileURL(join(root, "tests", "helpers", "fakeContentMain.js")).href;

async function runBootstrap(getURL) {
  vi.stubGlobal("chrome", { runtime: { getURL } });
  vi.resetModules();
  await import("../content/content.js");
  await flush();
}

beforeEach(() => { globalThis.__sidepeaceStarted = 0; });
afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.__sidepeaceStarted;
});

describe("content/content.js", () => {
  it("is the only content script in the manifest, and a classic script (no import or export)", () => {
    expect(manifest.content_scripts[0].js).toEqual(["content/content.js"]);
    expect(readFileSync(join(root, "content", "content.js"), "utf8")).not.toMatch(/^\s*(import|export)\s/m);
  });

  it("asks Chrome for the address of content/main.js, a file the manifest makes web accessible", async () => {
    const getURL = vi.fn(() => FAKE_MAIN);

    await runBootstrap(getURL);

    expect(getURL).toHaveBeenCalledWith("content/main.js");
    expect(manifest.web_accessible_resources.flatMap((entry) => entry.resources)).toContain("content/main.js");
  });

  it("imports that file and starts the content script once", async () => {
    await runBootstrap(() => FAKE_MAIN);

    expect(globalThis.__sidepeaceStarted).toBe(1);
  });

  it("logs and stays quiet when the file cannot be loaded (for example the extension was reloaded)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBootstrap(() => pathToFileURL(join(root, "does-not-exist.js")).href);

    expect(globalThis.__sidepeaceStarted).toBe(0);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("logs and stays quiet when chrome.runtime is gone", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await runBootstrap(() => { throw new Error("Extension context invalidated."); });

    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
