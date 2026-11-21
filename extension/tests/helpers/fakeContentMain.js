// Stands in for content/main.js in the content.js bootstrap test: it only records that startContent() ran.
export function startContent() {
  globalThis.__sidepeaceStarted = (globalThis.__sidepeaceStarted ?? 0) + 1;
  return () => {};
}
