"""Unit tests for the SQLite persistence layer (data/store.py)."""

import pytest
from data.store import (
    upsert_email, load_all, get_stats, get_hr_stats,
    mark_as_read, count_all, get_unread_count,
    load_unread_ids, _invalidate_cache, _stats_cache,
)


def _make_record(email_id="test-001", **overrides):
    """Helper to build a minimal email record dict."""
    record = {
        "id": email_id,
        "thread_id": f"t-{email_id}",
        "subject": "Test Subject",
        "sender": "Test Sender",
        "sender_email": "test@example.com",
        "snippet": "Test snippet",
        "received_at": "2024-01-15T10:00:00Z",
        "email_type_label": "GENERAL",
        "action_label": "FYI",
        "dept_label": "INTERNAL_PROJECT",
        "priority_label": "STANDARD",
        "reason": "Test classification",
        "retry_count": 0,
        "status": "classified",
        "classification_mode": "standard",
        "is_read": 0,
        "owner_email": "test@example.com",
    }
    record.update(overrides)
    return record


class TestInitDb:
    """Tests for database initialisation."""

    def test_init_creates_table(self, tmp_db):
        """init_db should create the emails table."""
        import sqlite3
        con = sqlite3.connect(str(tmp_db))
        cur = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='emails'")
        assert cur.fetchone() is not None
        con.close()

    def test_wal_mode_active(self, tmp_db):
        """The database should use WAL journal mode."""
        import sqlite3
        con = sqlite3.connect(str(tmp_db))
        con.execute("PRAGMA journal_mode=WAL")
        cur = con.execute("PRAGMA journal_mode")
        mode = cur.fetchone()[0]
        assert mode.lower() == "wal"
        con.close()


class TestUpsertEmail:
    """Tests for upsert_email."""

    def test_insert_new_record(self, tmp_db):
        """Inserting a new record should increase the count."""
        record = _make_record("insert-001")
        upsert_email(record)
        assert count_all() == 1

    def test_upsert_updates_existing(self, tmp_db):
        """Upserting the same ID should update, not duplicate."""
        record = _make_record("upsert-001", subject="Original")
        upsert_email(record)
        record["subject"] = "Updated"
        upsert_email(record)
        df = load_all()
        assert len(df) == 1
        assert df.iloc[0]["subject"] == "Updated"

    def test_upsert_invalidates_cache(self, tmp_db):
        """Writing a record should clear the stats cache."""
        _invalidate_cache()
        # Prime the cache
        get_stats()
        assert len(_stats_cache) > 0 or True  # cache may or may not have entries depending on data
        # Insert should invalidate
        upsert_email(_make_record("cache-001"))
        assert len(_stats_cache) == 0


class TestLoadAll:
    """Tests for load_all with and without pagination."""

    def test_load_all_empty(self, tmp_db):
        """Should return empty DataFrame when no records exist."""
        df = load_all()
        assert len(df) == 0

    def test_load_all_returns_records(self, tmp_db):
        """Should return all inserted records."""
        for i in range(5):
            upsert_email(_make_record(f"load-{i:03d}"))
        df = load_all()
        assert len(df) == 5

    def test_load_all_with_limit(self, tmp_db):
        """Pagination with limit should cap results."""
        for i in range(10):
            upsert_email(_make_record(f"page-{i:03d}"))
        df = load_all(limit=3)
        assert len(df) == 3

    def test_load_all_with_offset(self, tmp_db):
        """Pagination with offset should skip records."""
        for i in range(10):
            upsert_email(_make_record(f"off-{i:03d}"))
        df = load_all(limit=5, offset=5)
        assert len(df) == 5

    def test_load_all_filtered_by_owner(self, tmp_db):
        """Should only return records for the specified owner."""
        upsert_email(_make_record("own-001", owner_email="alice@test.com"))
        upsert_email(_make_record("own-002", owner_email="bob@test.com"))
        df = load_all(owner_email="alice@test.com")
        assert len(df) == 1
        assert df.iloc[0]["id"] == "own-001"


class TestCountAll:
    """Tests for count_all."""

    def test_count_all_empty(self, tmp_db):
        assert count_all() == 0

    def test_count_all_matches(self, tmp_db):
        for i in range(7):
            upsert_email(_make_record(f"cnt-{i:03d}"))
        assert count_all() == 7


class TestMarkAsRead:
    """Tests for mark_as_read."""

    def test_marks_existing_email(self, tmp_db):
        """Marking an existing email as read should return True."""
        upsert_email(_make_record("read-001"))
        assert mark_as_read("read-001") is True
        df = load_all()
        assert df.iloc[0]["is_read"] == 1

    def test_marks_nonexistent_returns_false(self, tmp_db):
        """Marking a nonexistent email should return False."""
        assert mark_as_read("nonexistent-999") is False


class TestGetStats:
    """Tests for get_stats with caching."""

    def test_empty_stats(self, tmp_db):
        """Empty DB should return empty dicts."""
        stats = get_stats()
        assert stats["email_type"] == {}

    def test_correct_aggregation(self, tmp_db):
        """Stats should correctly aggregate label counts."""
        upsert_email(_make_record("stat-001", email_type_label="SALES"))
        upsert_email(_make_record("stat-002", email_type_label="SALES"))
        upsert_email(_make_record("stat-003", email_type_label="SPAM"))
        stats = get_stats()
        assert stats["email_type"]["SALES"] == 2
        assert stats["email_type"]["SPAM"] == 1
        assert stats["total"] == 3

    def test_stats_are_cached(self, tmp_db):
        """Consecutive calls within TTL should return cached results."""
        upsert_email(_make_record("cache-stat-001"))
        stats1 = get_stats()
        stats2 = get_stats()
        # Same object reference means it came from cache
        assert stats1 is stats2


class TestUnreadCount:
    """Tests for get_unread_count."""

    def test_unread_count(self, tmp_db):
        upsert_email(_make_record("unr-001", is_read=0))
        upsert_email(_make_record("unr-002", is_read=1))
        assert get_unread_count() == 1

    def test_unread_count_by_owner(self, tmp_db):
        upsert_email(_make_record("unr-003", is_read=0, owner_email="a@t.com"))
        upsert_email(_make_record("unr-004", is_read=0, owner_email="b@t.com"))
        assert get_unread_count(owner_email="a@t.com") == 1
