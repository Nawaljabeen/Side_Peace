# Gemini HTML fixtures (risk R-01)

| File | What it is |
|---|---|
| `gemini-conversation.html` | **Real structure** of a Gemini chat page, copied with Chrome DevTools (Copy outerHTML) on 2026-11-19. Angular noise (`_ngcontent-*`, `jslog`, `data-ved`, comments, button internals) was removed and the text was replaced with neutral sample text. The second exchange was made by duplicating the first. |
| `gemini-changed-structure.html` | **Synthetic.** The same page with Gemini's custom tags renamed (`user-query` -> `user-prompt`, `model-response` -> `ai-answer`, ...) to simulate a Gemini redesign. Used to prove the fallback selectors in `content/selectors.js` work. |

When Gemini changes its DOM: save the new page here as a new fixture, watch the parser test go red, then fix `content/selectors.js`.
