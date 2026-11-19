# Black-box UI script - Side Panel (REQ-F04)

Run on 2026-11-19 in Chrome with the unpacked extension loaded (service worker `service_worker.js` started, 0 page exceptions).
**Limitation:** captured on a harness page that serves the real `sidepanel/` code with a demo bridge (1.5 s delay, switchable to a failing bridge).
The real-Gemini run (needs a signed-in Google session) and the real ExtensionBridge are still to be done by Ammar; add those screenshots next to these.

| Step | Action | Expected | Result | Screenshot |
|---|---|---|---|---|
| 1 | Open panel | Idle: empty form, hint text | Pass | screenshots/1-idle.png |
| 2 | Click Ask with empty box | Inline message "Please type a question."; no request | Pass | screenshots/2-validation-empty.png |
| 3 | Enter a question, click Ask | Ask button disabled while loading | Pass | screenshots/3-loading.png |
| 4 | Wait for reply | Answer shown as text; button enabled again | Pass | screenshots/4-answer.png |
| 5 | Ask again with the bridge failing | Friendly error, previous answer cleared, button enabled | Pass (after fix f04b9b6) | screenshots/5-network-error.png |

Defect found by this script: the previous answer stayed visible next to the network error. Fixed test-first (commits 63d4542, f04b9b6, PR #21).
