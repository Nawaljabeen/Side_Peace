// Test helpers: load saved Gemini pages and API-contract examples.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Read a saved Gemini HTML fixture (tests/fixtures/<name>) as a string. */
export function loadFixture(name) {
  return readFileSync(join(here, "..", "fixtures", name), "utf8");
}

/** Read an example JSON file from the API contract (docs/contract/<name>). */
export function loadContractExample(name) {
  const path = join(here, "..", "..", "..", "docs", "contract", name);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Replace the document body with a fixture page and return the body. */
export function mountFixture(name) {
  document.body.innerHTML = loadFixture(name);
  return document.body;
}
