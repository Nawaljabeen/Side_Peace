// Session ids (REQ-F02). One Gemini chat = one backend session, so the side question for chat A never
// sees the history of chat B. The id is derived from the chat's address, which makes it stable across
// service-worker restarts without having to store anything.

// Same rule as the backend (docs/api-contract.md): 1-64 characters from A-Z a-z 0-9 _ -
export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const PREFIX = "g-";
const NEW_CHAT_ID = `${PREFIX}new`; // used until Gemini has put a chat id into the address
const MAX_LENGTH = 64;

/**
 * @param {string | null | undefined} pathname  location.pathname of the Gemini tab, e.g. "/app/7aef0c969e3d2551"
 * @returns {string} a contract-valid session id
 */
export function sessionIdFor(pathname) {
  const withoutQuery = String(pathname ?? "").split(/[?#]/)[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last || last === "app") {
    return NEW_CHAT_ID;
  }
  const safe = last.replace(/[^A-Za-z0-9_-]/g, "-");
  return `${PREFIX}${safe}`.slice(0, MAX_LENGTH);
}
