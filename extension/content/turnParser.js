/**
 * TurnParser - turns the Gemini chat DOM into contract-shaped turns.
 *
 * Pure and read-only: it only queries and reads, it never edits the page (REQ-F01).
 * Every Gemini selector comes from selectors.js (R-01).
 */
import { GEMINI_SELECTORS } from "./selectors.js";

const DOCUMENT_POSITION_FOLLOWING = 4;
const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "UL", "OL", "PRE", "BLOCKQUOTE", "TABLE", "TR", "BR", "HR",
]);

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

function turnText(element, textSelector, ignoreSelector) {
  const parts = Array.from(element.querySelectorAll(textSelector), (node) =>
    nodeText(node, ignoreSelector),
  );
  return parts.filter((part) => part !== "").join("\n");
}

/**
 * @param {ParentNode} root  element that contains the whole chat
 * @returns {{index: number, role: "user"|"model", text: string}[]}
 */
export function parseTurns(root, selectors = GEMINI_SELECTORS) {
  const found = [
    ...Array.from(root.querySelectorAll(selectors.user.turn), (element) => ({
      element,
      role: "user",
      textSelector: selectors.user.text,
    })),
    ...Array.from(root.querySelectorAll(selectors.model.turn), (element) => ({
      element,
      role: "model",
      textSelector: selectors.model.text,
    })),
  ].sort((a, b) => (a.element.compareDocumentPosition(b.element) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const turns = [];
  for (const { element, role, textSelector } of found) {
    const text = turnText(element, textSelector, selectors.ignore);
    if (text === "") {
      continue;
    }
    turns.push({ index: turns.length, role, text });
  }
  return turns;
}
