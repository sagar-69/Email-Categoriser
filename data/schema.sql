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
    hr_reasoning         TEXT,
    is_read              INTEGER DEFAULT 0,
    owner_email          TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_type ON emails(email_type_label);
CREATE INDEX IF NOT EXISTS idx_priority   ON emails(priority_label);
CREATE INDEX IF NOT EXISTS idx_action     ON emails(action_label);
CREATE INDEX IF NOT EXISTS idx_dept       ON emails(dept_label);
CREATE INDEX IF NOT EXISTS idx_hr_category ON emails(hr_category);
CREATE INDEX IF NOT EXISTS idx_classification_mode ON emails(classification_mode);
CREATE INDEX IF NOT EXISTS idx_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_owner_email ON emails(owner_email);

-- ── Reply feature v2: delayed send queue ────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_sends (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id          TEXT NOT NULL,
    gmail_draft_id    TEXT NOT NULL,
    draft_text        TEXT NOT NULL,
    final_text        TEXT NOT NULL,
    status            TEXT DEFAULT 'scheduled',
    scheduled_send_at TEXT NOT NULL,
    created_at        TEXT DEFAULT (datetime('now')),
    owner_email       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_sends(status);
CREATE INDEX IF NOT EXISTS idx_pending_send_at ON pending_sends(scheduled_send_at);

-- ── Reply feature v2: audit log ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sent_replies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id    TEXT NOT NULL,
    draft_text  TEXT NOT NULL,
    final_text  TEXT NOT NULL,
    message_id  TEXT,
    sent_at     TEXT DEFAULT (datetime('now')),
    owner_email TEXT
);

