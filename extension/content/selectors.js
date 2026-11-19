/**
 * Every Gemini-specific CSS selector lives in this file (risk R-01).
 * When Gemini changes its page, this is the only file that should need an edit.
 *
 * Captured from real Gemini markup on 2026-11-19 (see tests/fixtures/README.md).
 */
export const GEMINI_SELECTORS = Object.freeze({
  user: Object.freeze({
    // One element per question; the text sits in one <p> per line.
    turn: "user-query",
    text: ".query-text-line",
  }),
  model: Object.freeze({
    // One element per answer; the answer text is the markdown block inside it.
    turn: "model-response",
    text: "message-content .markdown",
  }),
  // Never part of the text: the code block header ("Java") and screen-reader labels ("You said").
  ignore: ".code-block-decoration, .cdk-visually-hidden",
});
