
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const GEMINI = "https://gemini.google.com/*";
const BACKEND = "http://localhost:8000/*";

describe("manifest.json", () => {
  it("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  
  it("injects content scripts only on Gemini", () => {
    const matches = manifest.content_scripts.flatMap((cs) => cs.matches);
    expect(matches).toEqual([GEMINI]);
  });

  it("requests host access only for Gemini and the local backend", () => {
    expect([...manifest.host_permissions].sort()).toEqual([BACKEND, GEMINI].sort());
  });

  it("declares the side panel", () => {
    expect(manifest.permissions).toContain("sidePanel");
    expect(manifest.side_panel.default_path).toBe("sidepanel/sidepanel.html");
  });

  it("points only at files that exist (so 'Load unpacked' works)", () => {
    const files = [
      manifest.background.service_worker,
      manifest.side_panel.default_path,
      ...manifest.content_scripts.flatMap((cs) => cs.js),
    ];
    for (const f of files) expect(existsSync(join(root, f)), f).toBe(true);
  });

  // The content script loads its modules with a dynamic import, which needs web_accessible_resources.
  // QR-03: they may be exposed to gemini.google.com only, never to every site.
  it("exposes the content-script modules only to Gemini (QR-03)", () => {
    const entries = manifest.web_accessible_resources ?? [];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.matches).toEqual([GEMINI]);
      expect(entry.extension_ids).toBeUndefined();
    }
    const exposed = entries.flatMap((entry) => entry.resources);
    expect(exposed).toContain("content/contentScript.js");
    expect(exposed).not.toContain("*");
    expect(exposed.every((r) => r.startsWith("content/") || r.startsWith("shared/"))).toBe(true);
  });

  it("only exposes files that exist", () => {
    for (const entry of manifest.web_accessible_resources ?? []) {
      for (const resource of entry.resources) {
        if (!resource.includes("*")) expect(existsSync(join(root, resource)), resource).toBe(true);
      }
    }
  });
});