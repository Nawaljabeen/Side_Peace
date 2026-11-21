// The service worker's door (REQ-F02, REQ-Q02, DEC-09). The content script and the side panel never call the
// backend; they send chrome.runtime messages and this handler passes them to the ExtensionBridge:
//   {type: "sync-turn", conversationPath, turn}   from the content script: one per finished chat turn
//   {type: "query", text}                         from the side panel: a side question about the active chat
//   {type: "health"}                              from the side panel: is the server up? (also wakes the worker)
// Every reply is {ok: true, ...} or {ok: false, error: <plain object>}. This function never throws.
import { ValidationError, toErrorPayload } from "../shared/errors.js";
import { sessionIdFor } from "./sessionId.js";

/**
 * @param {object} deps
 * @param {{syncTurn: Function, sendQuery: Function, checkHealth: Function}} deps.bridge
 * @param {() => Promise<{path: string, tabId: number} | null>} deps.getActiveConversation
 *        the Gemini chat the user is looking at, or null when the active tab is not Gemini
 * @param {string} deps.ownExtensionId  a message from any other sender is refused
 */
export function createMessageHandler({ bridge, getActiveConversation, ownExtensionId }) {
  return async function handleMessage(message, sender) {
    try {
      if (!sender || sender.id !== ownExtensionId) {
        throw new ValidationError("This sender is not allowed to use SidePeace.");
      }
      switch (message?.type) {
        case "sync-turn": {
          const sessionId = sessionIdFor(message.conversationPath, sender.tab?.id);
          return { ok: true, turnCount: await bridge.syncTurn(sessionId, message.turn) };
        }
        case "query": {
          const conversation = await getActiveConversation();
          if (!conversation) {
            throw new ValidationError("Open a Gemini chat first, then ask your side question.");
          }
          const sessionId = sessionIdFor(conversation.path, conversation.tabId);
          return { ok: true, answer: await bridge.sendQuery(sessionId, message.text) };
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
