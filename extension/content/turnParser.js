/**
 * TurnParser - turns the Gemini chat DOM into contract-shaped turns.
 *
 * Pure and read-only: it only queries and reads, it never edits the page (REQ-F01).
 * Every Gemini selector comes from selectors.js (R-01). Anything unexpected
 * (no chat, empty answer, a selector the browser rejects) gives fewer turns,
 * never an exception (REQ-Q01).
 */
import { GEMINI_SELECTORS } from "./selectors.js";
import { MAX_TURN_TEXT_LENGTH } from "../shared/constants.js";

const DOCUMENT_POSITION_FOLLOWING = 4;
const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "UL", "OL", "PRE", "BLOCKQUOTE", "TABLE", "TR", "BR", "HR",
]);

/** querySelectorAll that treats a selector the browser rejects as "no match". */
function queryAll(root, selector) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    if (error.name === "SyntaxError") {
      return []; // an invalid selector in the config must not break the page
    }
    throw error;
  }
}

/** Matches of the first selector in the list that finds anything. */
function firstMatches(root, selectors) {
  for (const selector of selectors) {
    const found = queryAll(root, selector);
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

/**
 * Visible text of a node. Walks the tree once, skips ignored subtrees and puts
 * a line break before every block element (jsdom has no innerText).
 */
function nodeText(node, ignoreSelector) {
  const walker = node.ownerDocument.createTreeWalker(
    node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(current) {
        if (current.nodeType === Node.ELEMENT_NODE && current.matches(ignoreSelector)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  let text = "";
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current.nodeType === Node.TEXT_NODE) {
      text += current.nodeValue;
    } else if (BLOCK_TAGS.has(current.tagName)) {
      text += "\n";
    }
  }
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Text of a turn element: its text nodes if the selectors find them, else the whole element. */
function turnText(element, textSelectors, ignoreSelector) {
  const matches = firstMatches(element, textSelectors);
  const nodes = matches.length > 0 ? matches : [element];
  return nodes
    .map((node) => nodeText(node, ignoreSelector))
    .filter((part) => part !== "")
    .join("\n");
}

/**
 * @param {ParentNode} root  element that contains the whole chat
 * @returns {{index: number, role: "user"|"model", text: string}[]}
 *          turns in page order; text is cut to MAX_TURN_TEXT_LENGTH (API contract)
 */
export function parseTurns(root, selectors = GEMINI_SELECTORS) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const found = [
    ...firstMatches(root, selectors.user.turn).map((element) => ({
      element,
      role: "user",
      textSelectors: selectors.user.text,
    })),
    ...firstMatches(root, selectors.model.turn).map((element) => ({
      element,
      role: "model",
      textSelectors: selectors.model.text,
    })),
  ].sort((a, b) => (a.element.compareDocumentPosition(b.element) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const turns = [];
  for (const { element, role, textSelectors } of found) {
    const text = turnText(element, textSelectors, selectors.ignore).slice(0, MAX_TURN_TEXT_LENGTH);
    if (text === "") {
      continue; // e.g. an answer that has not started streaming yet
    }
    turns.push({ index: turns.length, role, text });
  }
  return turns;
}
