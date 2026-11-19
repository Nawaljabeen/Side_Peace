# Thread-safety strategy (storage layer)

Requirements: REQ-Q05 / QR-05 (no lost or interleaved writes), risk R-04 (SQLite "database is locked").
Code: `backend/database/write_queue.py`, `backend/database/sqlite_adapter.py`.

## 1. Shared state
- The single SQLite connection owned by the `SQLiteAdapter` Singleton (one database file, one connection).
- The per-session rows in `sessions` / `turns`, in particular the turn count that `add_turn` returns.
- `Turn` objects passed between coroutines are `@dataclass(frozen=True)`, so they cannot change underneath a caller.

## 2. Concurrent operations
- `POST /sync` x N: many coroutines call `SQLiteAdapter.add_turn` at the same time.
- `POST /query` x N: many coroutines call `get_turns` while writes may be running.
- Blocking SQLite calls run in worker threads (`asyncio.to_thread`) so the event loop stays free while Gemini or the database is slow.

## 3. Mechanism
- **Single-writer queue:** `WriteQueue` holds an `asyncio.Queue` and exactly one worker task. `SQLiteAdapter.add_turn` submits its write as a job; the worker runs jobs one at a time, in submission order, and returns each result (or exception) to the caller that submitted it.
- Each write is one explicit transaction (`BEGIN IMMEDIATE` ... `COMMIT`, `ROLLBACK` on error) executed with parameterised SQL.
- WAL mode and a 5 s busy timeout are enabled on the connection.
- Errors: `sqlite3.Error` is translated to `StorageError` in `SQLiteAdapter._run`. The worker catches any job exception only to forward it to the awaiting caller, so one failed write cannot stop later writes.

## 4. Why it is correct
- One consumer means two writes never overlap, so there is no interleaving of `BEGIN`/`COMMIT` on the shared connection and no lock ordering (no deadlock).
- Jobs run in FIFO order, so concurrent writes to the same `(session_id, index)` end with the last submitted value (test below).
- `add_turn` returns the count inside the same transaction as the upsert, so concurrent `/sync` calls report distinct, correct counts.
- Evidence of the problem the queue solves: before the queue existed, the 50-concurrent-writes tests failed with `sqlite3.OperationalError: cannot start a transaction within a transaction` (red commit of the concurrency pair in PR 3).

## 5. How it is tested
| Property | Test |
|---|---|
| Jobs never overlap; FIFO order; errors reach the caller; worker survives a failed job; `stop()` drains; restart after stop | `backend/tests/test_write_queue.py` |
| 50 concurrent writes lose nothing (REQ-Q05) | `test_50_concurrent_writes_lose_nothing` in `backend/tests/test_concurrency.py` |
| Distinct turn counts | `test_concurrent_writes_report_distinct_turn_counts` |
| Two interleaved sessions do not mix | `test_two_interleaved_sessions_do_not_mix` |
| Last submitted write wins for one index | `test_concurrent_writes_to_one_index_keep_the_last_submitted` |
| 50 concurrent `/query` requests (planned with the Gateway, Card 2A) | _to be added_ |

## Rejected alternatives
- **`asyncio.Lock` around each write:** would also be correct and is simpler. We kept the queue because the M1 design (QR-05, REQ-Q05, R-04) promises a centralised message queue, and a queue gives explicit FIFO order and one place to forward errors.
- **New connection per request:** many writers, so "database is locked" errors (R-04).
- **Blocking SQLite calls directly inside coroutines:** hides the race (calls never interleave) but blocks the event loop while the database works.

## Known limitations
- **Reads bypass the queue.** `get_turns` uses the same connection and can observe a write transaction that is in progress (including one that is later rolled back). Accepted for M2 because each write is a short single transaction; recorded as a known limitation.
- The queue is unbounded (no back-pressure); acceptable for one local user.