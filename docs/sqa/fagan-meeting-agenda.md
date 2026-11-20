# Fagan inspection: meeting kit (Moderator: Ammar)

Frozen SHA `e0192a5`; scope and roles in `fagan-checklist.md`. Date and outside inspector: _TBD_ (record them in the planning table when booked).

## Before the meeting (preparation phase, 2-3 hours each for 421 lines)
- Author (Nazaar): sends the overview (what each of the 8 files does, design decisions, known items) at least a day before.
- Every inspector, including the Author, reads the 8 files against the checklist C1-C12 and writes down findings as `file:line - what - type`.
- Moderator (Ammar): shares `fagan-moderator-prep.md` only **after** the others have sent their own notes, so it does not steer them. Candidate P-1 is the Moderator's.
- Everyone checks out `e0192a5` (`git checkout e0192a5`), not the latest `main`.

## Meeting (target 90 minutes, no fixing in the meeting)
| Min | Step | Who |
|---|---|---|
| 0-5 | Confirm SHA, scope, roles; remind the rules (find, do not fix; no blame; Author listens) | Moderator |
| 5-15 | Author's 10-minute overview of the architecture and the 8 files | Author |
| 15-70 | Reader paraphrases the code file by file in this order: `schemas.py`, `sync.py`, `query.py`, `error_handlers.py`, `session_manager.py`, `write_queue.py`, `sqlite_adapter.py`, `gemini_adapter.py`. Inspectors raise findings; Recorder logs each in the defect log (ID, file:line, description, type, severity). Disputes are logged, not argued | Reader, Recorder |
| 70-80 | Read back the log; agree type and severity (Major or Minor) for each | Moderator |
| 80-90 | Decide: pass, or pass with rework; assign an owner and a due date to every Major | Moderator |

## After the meeting
- Rework: the Author fixes each finding in a branch (`fix/...`), one commit pair per defect where code changes, and fills "fix commit" in the log.
- Follow-up: the Moderator re-runs the failing case, checks each fix against the original finding, and marks it Verified. Nothing is marked Verified without that re-run.
- Metrics to report: lines inspected (421), preparation hours, defects found per type and severity, defects per KLOC, rework time.

## Defect log (fill in at the meeting; real findings only)
| ID | file:line | Description | Type | Severity | Found by | CAPA action | Owner | Due | Status | Fix commit |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

## Message to send once a date exists
> Fagan inspection of Storage + Gateway at frozen SHA e0192a5 on <date, time>, <place/link>. Roles: Moderator Ammar, Author Nazaar, Reader/Recorder Nawal, outside inspector <name>. Please read the 8 in-scope files before the meeting (about 2-3 hours) using the checklist in docs/sqa/fagan-checklist.md, and send your findings list to Ammar the evening before. Nazaar: please send the Author's overview a day earlier.
