CREATE TABLE IF NOT EXISTS emails (
    id              TEXT PRIMARY KEY,
    thread_id       TEXT,
    subject         TEXT,
    sender          TEXT,
    sender_email    TEXT,
    snippet         TEXT,
    received_at     TEXT,
    action_label    TEXT,
    dept_label      TEXT,
    priority_label  TEXT,
    reason          TEXT,
    classified_at   TEXT,
    retry_count     INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'classified'
);

CREATE INDEX IF NOT EXISTS idx_priority ON emails(priority_label);
CREATE INDEX IF NOT EXISTS idx_action   ON emails(action_label);
CREATE INDEX IF NOT EXISTS idx_dept     ON emails(dept_label);
