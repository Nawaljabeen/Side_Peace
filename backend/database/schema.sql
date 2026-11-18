-- SidePeace storage schema. Idempotent: safe to run on every start.
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS turns (
    session_id TEXT    NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    idx        INTEGER NOT NULL CHECK (idx >= 0),
    role       TEXT    NOT NULL CHECK (role IN ('user', 'model')),
    text       TEXT    NOT NULL CHECK (length(text) BETWEEN 1 AND 20000),
    PRIMARY KEY (session_id, idx)
);