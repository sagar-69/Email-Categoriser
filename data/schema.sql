CREATE TABLE IF NOT EXISTS emails (
    id                TEXT PRIMARY KEY,
    thread_id         TEXT,
    subject           TEXT,
    sender            TEXT,
    sender_email      TEXT,
    snippet           TEXT,
    body_preview      TEXT,
    received_at       TEXT,
    email_type_label  TEXT,
    action_label      TEXT,
    dept_label        TEXT,
    priority_label    TEXT,
    reason            TEXT,
    classified_at     TEXT,
    retry_count       INTEGER DEFAULT 0,
    status            TEXT DEFAULT 'classified',
    -- HR Classification columns
    hr_category          TEXT,
    hr_confidence        REAL DEFAULT 0.0,
    hr_matched_keywords  TEXT,
    classification_mode  TEXT DEFAULT 'standard',
    hr_reasoning         TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_type ON emails(email_type_label);
CREATE INDEX IF NOT EXISTS idx_priority   ON emails(priority_label);
CREATE INDEX IF NOT EXISTS idx_action     ON emails(action_label);
CREATE INDEX IF NOT EXISTS idx_dept       ON emails(dept_label);
CREATE INDEX IF NOT EXISTS idx_hr_category ON emails(hr_category);
CREATE INDEX IF NOT EXISTS idx_classification_mode ON emails(classification_mode);

