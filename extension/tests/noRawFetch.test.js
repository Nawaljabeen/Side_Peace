// REQ-F02, DEC-09: the ExtensionBridge is the ONLY code that talks to the backend. This test scans the real
// source files and fails if any other file refers to `fetch`. (Verification test: it passes on first run,
// because the rule already holds; it guards against someone adding a raw fetch later.)
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FOLDERS = ["background", "content", "sidepanel", "shared"];
const BRIDGE = "background/extensionBridge.js";

// The side panel's start-up health check still calls fetch itself. It moves to the bridge when the panel is
// switched to the real bridge (Card 2C follow-up); remove these entries then. The last test below fails
// if an entry stays on this list after its file has stopped using fetch.
const KNOWN_EXCEPTIONS = [];

function sourceFiles(folder) {
  return readdirSync(join(root, folder)).flatMap((name) => {
    const path = join(folder, name);
    return statSync(join(root, path)).isDirectory() ? sourceFiles(path) : path.endsWith(".js") ? [path] : [];
  });
}

// Comments and text inside quotes are removed first, so "Failed to fetch" in a message does not count.
function usesFetch(path) {
  const code = readFileSync(join(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  return /\bfetch\b/.test(code);
}

const files = SOURCE_FOLDERS.flatMap(sourceFiles).map((path) => path.split("\\").join("/"));
const filesUsingFetch = files.filter(usesFetch);

describe("no raw fetch outside the ExtensionBridge", () => {
  it("scans the real source files and finds the bridge itself using fetch", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(filesUsingFetch).toContain(BRIDGE);
  });

  it("no other source file refers to fetch, except the listed panel health check", () => {
    const others = filesUsingFetch.filter((path) => path !== BRIDGE && !KNOWN_EXCEPTIONS.includes(path));

    expect(others).toEqual([]);
  });

  it("every known exception still uses fetch (delete the entry once it does not)", () => {
    for (const path of KNOWN_EXCEPTIONS) {
      expect(filesUsingFetch, `${path} no longer uses fetch: remove it from KNOWN_EXCEPTIONS`).toContain(path);
    }
  });
});
