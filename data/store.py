"""
SQLite persistence layer for classified emails.

All reads return pandas DataFrames.
All writes accept dicts or lists of dicts.
"""

import sqlite3
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger

from config.settings import DB_PATH

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(DB_PATH))


def init_db() -> None:
    """Create tables if they do not exist. Safe to call multiple times."""
    # First, ensure the base table exists (minimal schema)
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS emails (
                id                TEXT PRIMARY KEY,
                thread_id         TEXT,
                subject           TEXT,
                sender            TEXT,
                sender_email      TEXT,
                snippet           TEXT,
                received_at       TEXT,
                email_type_label  TEXT,
                action_label      TEXT,
                dept_label        TEXT,
                priority_label    TEXT,
                reason            TEXT,
                classified_at     TEXT,
                retry_count       INTEGER DEFAULT 0,
                status            TEXT DEFAULT 'classified'
            )
        """)
    # Then migrate to add any new columns (idempotent)
    migrate_hr_columns()
    # Finally, run the full schema script for indexes etc.
    with _conn() as con:
        con.executescript(SCHEMA_PATH.read_text())
    logger.info("Database initialised at {}", DB_PATH)


def migrate_hr_columns() -> None:
    """
    Safely add HR classification columns to existing databases.
    Idempotent — silently ignores if columns already exist.
    """
    new_columns = [
        ("body_preview",        "TEXT"),
        ("hr_category",         "TEXT"),
        ("hr_confidence",       "REAL DEFAULT 0.0"),
        ("hr_matched_keywords", "TEXT"),
        ("classification_mode", "TEXT DEFAULT 'standard'"),
        ("hr_reasoning",        "TEXT"),
    ]

    with _conn() as con:
        for col_name, col_type in new_columns:
            try:
                con.execute(f"ALTER TABLE emails ADD COLUMN {col_name} {col_type}")
                logger.debug("Added column '{}' to emails table.", col_name)
            except sqlite3.OperationalError:
                pass  # Column already exists

        # Add indexes (idempotent via IF NOT EXISTS)
        con.execute("CREATE INDEX IF NOT EXISTS idx_hr_category ON emails(hr_category)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_classification_mode ON emails(classification_mode)")


def upsert_email(record: dict) -> None:
    """
    Insert or replace a classified email record.
    record must contain all columns from schema.sql.
    """
    record.setdefault("classified_at", datetime.now(timezone.utc).isoformat())
    cols = ", ".join(record.keys())
    placeholders = ", ".join(["?"] * len(record))
    sql = f"INSERT OR REPLACE INTO emails ({cols}) VALUES ({placeholders})"
    with _conn() as con:
        con.execute(sql, list(record.values()))


def bulk_upsert(records: list[dict]) -> None:
    """Batch upsert a list of email records."""
    for r in records:
        upsert_email(r)
    logger.info("Upserted {} email records.", len(records))


def load_all() -> pd.DataFrame:
    """Return all classified emails as a DataFrame."""
    with _conn() as con:
        return pd.read_sql_query("SELECT * FROM emails ORDER BY received_at DESC", con)


def load_unread_ids() -> set[str]:
    """Return the set of email IDs already in the database."""
    with _conn() as con:
        cur = con.execute("SELECT id FROM emails")
        return {row[0] for row in cur.fetchall()}


def get_stats() -> dict:
    """Return aggregated counts per label group."""
    df = load_all()
    if df.empty:
        return {"email_type": {}, "action": {}, "dept": {}, "priority": {}}
    return {
        "email_type": df["email_type_label"].value_counts().to_dict(),
        "action":     df["action_label"].value_counts().to_dict(),
        "dept":       df["dept_label"].value_counts().to_dict(),
        "priority":   df["priority_label"].value_counts().to_dict(),
        "total":      len(df),
    }


# ── HR-specific query functions ──────────────────────────────────────────────

def load_hr_emails() -> pd.DataFrame:
    """Return emails classified in HR mode, excluding NON_HR."""
    with _conn() as con:
        return pd.read_sql_query(
            "SELECT * FROM emails WHERE classification_mode = 'hr' "
            "AND (hr_category IS NOT NULL AND hr_category != 'NON_HR') "
            "ORDER BY received_at DESC",
            con,
        )


def get_hr_stats() -> dict:
    """Return aggregated counts for HR categories."""
    df = load_hr_emails()
    if df.empty:
        return {
            "total_hr": 0,
            "LEAVE_OD": 0, "PAYROLL_COMP": 0, "RECRUITMENT": 0,
            "OFFBOARDING": 0, "HR_ADMIN": 0,
        }
    counts = df["hr_category"].value_counts().to_dict()
    return {
        "total_hr":     len(df),
        "LEAVE_OD":     counts.get("LEAVE_OD", 0),
        "PAYROLL_COMP": counts.get("PAYROLL_COMP", 0),
        "RECRUITMENT":  counts.get("RECRUITMENT", 0),
        "OFFBOARDING":  counts.get("OFFBOARDING", 0),
        "HR_ADMIN":     counts.get("HR_ADMIN", 0),
    }


def load_hr_unclassified_ids() -> set[str]:
    """Return IDs of emails not yet HR-classified."""
    with _conn() as con:
        cur = con.execute(
            "SELECT id FROM emails WHERE classification_mode != 'hr' OR classification_mode IS NULL"
        )
        return {row[0] for row in cur.fetchall()}

