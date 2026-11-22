// Session ids (REQ-F02). One Gemini chat = one backend session. The id is derived from the chat's address, so it
// stays the same when Chrome stops and restarts the service worker and nothing has to be stored.
const PREFIX = "g-";
const NEW_CHAT = `${PREFIX}new`;
const MAX_LENGTH = 64; // the contract's limit (docs/api-contract.md)

/**
 * @param {string | null | undefined} pathname  location.pathname of the Gemini tab, e.g. "/app/7aef0c969e3d2551"
 * @param {number} [tabId]  the browser's id of the tab; it separates two tabs that are both on a new chat
 * @returns {string} a contract-valid session id (1-64 characters of A-Z a-z 0-9 _ -)
 */
export function sessionIdFor(pathname, tabId) {
  const withoutQuery = String(pathname ?? "").split(/[?#]/)[0];
  const lastSegment = withoutQuery.split("/").filter(Boolean).pop();
  if (!lastSegment || lastSegment === "app") {
    // A new chat has no id yet. "g-new-<tab>" is at most 6 + 16 characters, so it always fits.
    return Number.isSafeInteger(tabId) && tabId >= 0 ? `${NEW_CHAT}-${tabId}` : NEW_CHAT;
  }
  const safe = lastSegment.replace(/[^A-Za-z0-9_-]/g, "-");
  return `${PREFIX}${safe}`.slice(0, MAX_LENGTH);
}
