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
    with _conn() as con:
        con.executescript(SCHEMA_PATH.read_text())
    logger.info("Database initialised at {}", DB_PATH)


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
        return {"action": {}, "dept": {}, "priority": {}}
    return {
        "action":   df["action_label"].value_counts().to_dict(),
        "dept":     df["dept_label"].value_counts().to_dict(),
        "priority": df["priority_label"].value_counts().to_dict(),
        "total":    len(df),
    }
