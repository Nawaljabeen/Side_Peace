/**
 * Every Gemini-specific CSS selector lives in this file (risk R-01).
 * When Gemini changes its page, this is the only file that should need an edit.
 *
 * Each list is tried in order and the first selector that matches wins, so the
 * first entry is Gemini's current structure and later entries are fallbacks.
 * Captured from real Gemini markup on 2026-11-19 (see tests/fixtures/README.md).
 */
export const GEMINI_SELECTORS = Object.freeze({
  user: Object.freeze({
    // One element per question; the text sits in one <p> per line.
    turn: Object.freeze(["user-query", ".query-text"]),
    text: Object.freeze([".query-text-line"]),
  }),
  model: Object.freeze({
    // One element per answer; the answer text is the markdown block inside it.
    turn: Object.freeze(["model-response", ".response-container"]),
    text: Object.freeze(["message-content .markdown", ".markdown"]),
  }),
  // Never part of the text: the code block header ("Java") and screen-reader labels ("You said").
  ignore: ".code-block-decoration, .cdk-visually-hidden",
});
