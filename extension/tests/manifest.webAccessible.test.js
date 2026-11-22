// QR-03, DEC-23: content.js loads content/main.js with a dynamic import(), and a page script may only import
// files the manifest lists in web_accessible_resources. The list is checked against the real imports in the
// code, so a new import that is not listed fails here and not only in Chrome. Only Gemini may load them.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const GEMINI = "https://gemini.google.com/*";
const IMPORT_PATTERN = /^\s*(?:import|export)\b[^'"]*?from\s*["'](\.{1,2}\/[^"']+)["']/gm;

/** Every file reachable from `entry` through relative imports, as paths relative to the extension root. */
function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(join(root, file), "utf8");
    for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
      queue.push(relative(root, resolve(dirname(join(root, file)), specifier)).replaceAll("\\", "/"));
    }
  }
  return [...seen];
}

describe("manifest.json web_accessible_resources", () => {
  const entries = manifest.web_accessible_resources ?? [];
  const listed = entries.flatMap((entry) => entry.resources);

  it("exists and can be loaded from Gemini pages only", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.matches).toEqual([GEMINI]);
  });

  it("lists exactly the modules content/main.js needs: all of them, and nothing more", () => {
    expect([...listed].sort()).toEqual(reachableFrom("content/main.js").sort());
  });

  it("lists no wildcards, and every listed file exists", () => {
    for (const file of listed) {
      expect(file).not.toContain("*");
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it("does not expose the service worker or the side panel to web pages", () => {
    for (const file of listed) {
      expect(file.startsWith("background/")).toBe(false);
      expect(file.startsWith("sidepanel/")).toBe(false);
    }
  });
});
