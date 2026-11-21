// The service worker's message entry point (REQ-F02, REQ-Q02).
//
// The content script and the side panel never call the backend. They send chrome.runtime messages:
//   {type: "sync-turn", conversationPath, turn}  from the content script (one per finished turn)
//   {type: "query", text}                         from the side panel (the session is the active tab's chat)
//   {type: "health"}                              from the side panel (also wakes the service worker, R-05)
// and receive {ok: true, ...} or {ok: false, error: <plain object, see shared/errors.js>}.
// This function never throws: every failure becomes a typed error payload.
import { ValidationError, toErrorPayload } from "../shared/errors.js";
import { sessionIdFor } from "./sessionId.js";

const MAX_TURN_TEXT_LENGTH = 20000; // docs/api-contract.md
const MAX_QUERY_LENGTH = 2000; // docs/api-contract.md (same value as extension/shared/constants.js)
const ROLES = new Set(["user", "model"]);

function validateTurn(turn) {
  const valid =
    turn !== null &&
    typeof turn === "object" &&
    Number.isInteger(turn.index) &&
    turn.index >= 0 &&
    ROLES.has(turn.role) &&
    typeof turn.text === "string" &&
    turn.text.length >= 1 &&
    turn.text.length <= MAX_TURN_TEXT_LENGTH;
  if (!valid) {
    throw new ValidationError("The chat turn is not valid.");
  }
}

function validateQuery(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed.length < 1 || trimmed.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`The question must be 1-${MAX_QUERY_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * @param {object} deps
 * @param {{sendQuery: Function, syncTurn: Function, checkHealth: Function}} deps.bridge
 * @param {() => Promise<string>} deps.getActiveConversationPath  pathname of the Gemini chat the user is looking at
 * @param {string} deps.ownExtensionId  messages from any other sender are refused
 */
export function createMessageHandler({ bridge, getActiveConversationPath, ownExtensionId }) {
  return async function handleMessage(message, sender) {
    try {
      if (!sender || sender.id !== ownExtensionId) {
        throw new ValidationError("This sender is not allowed to use SidePeace.");
      }
      switch (message?.type) {
        case "sync-turn": {
          validateTurn(message.turn);
          const turnCount = await bridge.syncTurn(sessionIdFor(message.conversationPath), message.turn);
          return { ok: true, turnCount };
        }
        case "query": {
          const text = validateQuery(message.text);
          const answer = await bridge.sendQuery(sessionIdFor(await getActiveConversationPath()), text);
          return { ok: true, answer };
        }
        case "health":
          return { ok: true, healthy: await bridge.checkHealth() };
        default:
          throw new ValidationError("Unknown message.");
      }
    } catch (error) {
      return { ok: false, error: toErrorPayload(error) };
    }
  };
}
