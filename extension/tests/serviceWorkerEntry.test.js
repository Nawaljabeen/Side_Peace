// R-05: the real entry file of the service worker (the file named in manifest.json) must set everything up as soon
// as Chrome runs it. This loads that file with a fake `chrome` and checks the result.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function stubChrome(setPanelBehavior) {
  const addListener = vi.fn();
  vi.stubGlobal("chrome", {
    runtime: { id: "my-extension-id", onMessage: { addListener } },
    tabs: { query: vi.fn().mockResolvedValue([]) },
    sidePanel: { setPanelBehavior },
  });
  return addListener;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("background/service_worker.js", () => {
  it("is the file manifest.json names as the service worker", () => {
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

    expect(manifest.background.service_worker).toBe("background/service_worker.js");
    expect(manifest.background.type).toBe("module");
  });

  it("registers the message listener and the side panel behaviour when it first runs", async () => {
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
    const addListener = stubChrome(setPanelBehavior);

    await import("../background/service_worker.js");

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  it("registers the listener even if the side panel call never finishes", async () => {
    const addListener = stubChrome(vi.fn(() => new Promise(() => {})));

    await import("../background/service_worker.js");

    expect(addListener).toHaveBeenCalledTimes(1);
  });
});
