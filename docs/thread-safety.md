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
- A `threading.Lock` (`_conn_lock`) guards every use of the connection: a whole write transaction, and each read. Worker threads therefore never use the shared connection at the same time.
- WAL mode and a 5 s busy timeout are enabled on the connection.
- Errors: `sqlite3.Error` is translated to `StorageError` in `SQLiteAdapter._run`. The worker catches any job exception only to forward it to the awaiting caller, so one failed write cannot stop later writes.

## 4. Why it is correct
- One consumer means two writes never overlap, so there is no interleaving of `BEGIN`/`COMMIT` on the shared connection and no lock ordering (no deadlock).
- Jobs run in FIFO order, so concurrent writes to the same `(session_id, index)` end with the last submitted value (test below).
- `add_turn` returns the count inside the same transaction as the upsert, so concurrent `/sync` calls report distinct, correct counts.
- Reads take the same lock, so a read never runs while a write transaction is open: it sees only committed data, and two reads never use the connection together.
- Evidence of the problem the queue solves: before the queue existed, the 50-concurrent-writes tests failed with `sqlite3.OperationalError: cannot start a transaction within a transaction` (red commit of the concurrency pair in PR 3).

## 5. How it is tested
| Property | Test |
|---|---|
| Jobs never overlap; FIFO order; errors reach the caller; worker survives a failed job; `stop()` drains; restart after stop | `backend/tests/test_write_queue.py` |
| 50 concurrent writes lose nothing (REQ-Q05) | `test_50_concurrent_writes_lose_nothing` in `backend/tests/test_concurrency.py` |
| Distinct turn counts | `test_concurrent_writes_report_distinct_turn_counts` |
| Two interleaved sessions do not mix | `test_two_interleaved_sessions_do_not_mix` |
| Last submitted write wins for one index | `test_concurrent_writes_to_one_index_keep_the_last_submitted` |
| 100 concurrent reads succeed; reads during writes never fail and see a consistent prefix | `test_100_concurrent_reads_all_succeed`, `test_reads_during_writes_never_fail_and_see_a_consistent_prefix` in `test_concurrency.py` |
| 50 concurrent `/sync` and `/query` through the whole gateway | `backend/tests/test_gateway_integration.py` |

## Rejected alternatives
- **`asyncio.Lock` around each write:** would also be correct and is simpler. We kept the queue because the M1 design (QR-05, REQ-Q05, R-04) promises a centralised message queue, and a queue gives explicit FIFO order and one place to forward errors.
- **New connection per request:** many writers, so "database is locked" errors (R-04).
- **Blocking SQLite calls directly inside coroutines:** hides the race (calls never interleave) but blocks the event loop while the database works.

## Defect found by the gateway tests (CAPA-01)
- **Symptom:** 100 concurrent reads, or reads during writes, raised `sqlite3.InterfaceError: bad parameter or other API misuse` (turned into `StorageError`, so `/query` would answer 500 under load).
- **Root cause:** the first version let reads bypass the queue and share the single connection from several worker threads at once, which sqlite3 does not allow. The earlier "known limitation" understated this (it described only dirty reads).
- **Fix:** `_conn_lock` around every read and every write transaction. Red test first (`test(storage): red - concurrent reads ...`), then the lock.

## Known limitations
- Reads wait for an in-progress write (they share one connection under a lock); fine for one local user and short transactions.
- The queue is unbounded (no back-pressure); acceptable for one local user.