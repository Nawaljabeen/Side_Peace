# Black-box UI script - Side Panel (REQ-F04)

Run 2026-11-19, Chrome 157 (automated, headless), extension loaded unpacked from `extension/` on branch `feature/panel-controller`
(Extensions.loadUnpacked succeeded, extension id `khlgoioiljhkdgldkjhmjkjeoiejnaef`, 0 page exceptions), real `https://gemini.google.com/app` open in another tab.

**Limitations (be honest in the report):**
- Gemini was **not signed in** (no Google credentials were used), so no real chat was extracted; `gemini-page.png` only shows the real page with the extension loaded.
- The panel was opened as a tab at `chrome-extension://<id>/sidepanel/sidepanel.html`, not through Chrome's side-panel UI.
- The panel uses the demo fake bridge until Nawal's ExtensionBridge merges, so the **network error** state cannot occur in the real page; step 6 uses a harness with a failing bridge.
- `chrome://extensions` (Developer mode on) shows SidePeace 0.1.0 enabled, service worker inspectable, **no Errors button** (screenshots/0-chrome-extensions-page.png; automated Chrome profile, not your daily profile).
- Still to do by hand: a signed-in Gemini run.

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

## Signed-in run on real Gemini (2026-11-19, 10:18)

The real extension (loaded unpacked in Ammar's own signed-in Chrome 157, branch `feature/panel-controller`) was opened beside a signed-in
`gemini.google.com` chat. The panel was shown in its own window next to Gemini, and driven with Tab/Enter only. The Gemini sidebar (account
name and chat titles) is cropped out of the images. The panel still uses the demo bridge (`?demo=fail` simulates the failure).

| State | Expected | Result | Screenshot |
|---|---|---|---|
| Idle | Empty form, hint text | Pass | screenshots/signed-1-idle.png |
| Validation error | "Please type a question.", no request | Pass | screenshots/signed-2-validation.png |
| Loading | Ask button disabled while the request runs | Pass | screenshots/signed-3-loading.png |
| Answer | Answer rendered as text under the form | Pass | screenshots/signed-4-answer.png |
| Network error | Friendly "Could not reach the SidePeace server" message, no answer shown | Pass | screenshots/signed-5-network-error.png |

Remaining limits: the panel is a separate window, not Chrome's built-in side-panel dock (the dock opened during the first attempt showed the stale Wave 0
placeholder because the panel was already open); the answers come from the demo bridge, not the real backend, until Nawal's ExtensionBridge merges.

**Correction:** an earlier version of this document claimed the extension's service worker had started. That was wrong: the worker I saw belonged to Chrome's built-in "Google Network Speech" component, because `--load-extension` is ignored in current branded Chrome. The extension was not actually loaded in that run; the results above come from the corrected run.
