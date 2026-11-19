# Black-box UI script - Side Panel (REQ-F04)

Run 2026-11-19, Chrome 157 (automated, headless), extension loaded unpacked from `extension/` on branch `feature/panel-controller`
(Extensions.loadUnpacked succeeded, extension id `khlgoioiljhkdgldkjhmjkjeoiejnaef`, 0 page exceptions), real `https://gemini.google.com/app` open in another tab.

**Limitations (be honest in the report):**
- Gemini was **not signed in** (no Google credentials were used), so no real chat was extracted; `gemini-page.png` only shows the real page with the extension loaded.
- The panel was opened as a tab at `chrome-extension://<id>/sidepanel/sidepanel.html`, not through Chrome's side-panel UI.
- The panel uses the demo fake bridge until Nawal's ExtensionBridge merges, so the **network error** state cannot occur in the real page; step 6 uses a harness with a failing bridge.
- Still to do by hand: a signed-in Gemini run and a check of `chrome://extensions` for an error badge.

| Step | Action | Expected | Result | Screenshot |
|---|---|---|---|---|
| 0 | Load extension, open Gemini | Loads, no exceptions | Pass | screenshots/gemini-page.png |
| 1 | Open panel | Idle: empty form, hint | Pass | screenshots/1-idle.png |
| 2 | Click Ask with empty box | "Please type a question."; no request | Pass | screenshots/2-validation-error.png |
| 3 | Enter question, click Ask | Ask disabled while loading | Pass | screenshots/3-loading.png |
| 4 | Wait for reply | Answer shown as text; button enabled | Pass | screenshots/4-answer.png |
| 5 | Enter 2001 characters, click Ask | "too long" message, no request | Pass; note the previous answer stays visible below the validation message (design choice, flag to the team) | screenshots/5-too-long-validation.png |
| 6 | Bridge failing (harness only) | Friendly error, old answer cleared | Pass after fix f04b9b6 | screenshots/6-network-error-harness.png |

Defect found by this script: the previous answer stayed visible next to a network error. Fixed test-first (commits 63d4542, f04b9b6, PR #21).

**Correction:** an earlier version of this document claimed the extension's service worker had started. That was wrong: the worker I saw belonged to Chrome's built-in "Google Network Speech" component, because `--load-extension` is ignored in current branded Chrome. The extension was not actually loaded in that run; the results above come from the corrected run.
