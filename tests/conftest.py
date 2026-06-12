"""
Shared pytest fixtures for Inbox Intel test suite.
"""

import sqlite3
import pytest
from pathlib import Path


@pytest.fixture
def sample_email():
    """Return a standard email dict matching the fetcher output format."""
    return {
        "id": "test-001",
        "thread_id": "t-001",
        "subject": "Invoice overdue payment required",
        "sender": "Vendor Corp",
        "sender_email": "billing@vendor.com",
        "snippet": "Your invoice #4821 is 30 days overdue.",
        "body_preview": "Dear Customer, your invoice #4821 is overdue by 30 days. Please remit payment.",
        "received_at": "2024-01-15T10:00:00Z",
    }


@pytest.fixture
def sample_hr_email():
    """Return an HR-related email dict."""
    return {
        "id": "hr-001",
        "thread_id": "t-hr-001",
        "subject": "Leave Application - Sick Leave Request",
        "sender": "Alice Johnson",
        "sender_email": "alice@company.com",
        "snippet": "I would like to apply for sick leave from Jan 20 to Jan 22.",
        "body_preview": "Dear HR, I am feeling unwell and need to apply for sick leave.",
        "received_at": "2024-01-15T10:00:00Z",
    }


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """
    Create a temporary SQLite database for store tests.
    Patches DB_PATH to point to the temp location.
    """
    db_path = tmp_path / "test_emails.db"

    # Patch the module-level DB_PATH in data.store
    import data.store as store_module
    monkeypatch.setattr(store_module, "DB_PATH", db_path)

    # Also patch SCHEMA_PATH to ensure it points to the real schema file
    schema_path = Path(__file__).parent.parent / "data" / "schema.sql"
    monkeypatch.setattr(store_module, "SCHEMA_PATH", schema_path)

    # Initialise the database
    store_module.init_db()

    return db_path


@pytest.fixture
def make_email_state():
    """Factory fixture to create EmailState dicts with defaults."""
    def _make(**kwargs):
        base = {
            "id": "test-001",
            "thread_id": "t-001",
            "subject": "Invoice overdue payment required",
            "sender": "Vendor Corp",
            "sender_email": "billing@vendor.com",
            "snippet": "Your invoice #4821 is 30 days overdue.",
            "body_preview": "",
            "received_at": "2024-01-15",
            "prompt": None,
            "raw_response": None,
            "email_type_label": None,
            "action_label": None,
            "dept_label": None,
            "priority_label": None,
            "reason": None,
            "retry_count": 0,
            "status": "pending",
            "error": None,
            "classification_mode": "standard",
            "hr_category": None,
            "hr_confidence": None,
            "hr_matched_keywords": None,
            "hr_reasoning": None,
            "hr_prompt": None,
            "hr_raw_response": None,
            "owner_email": None,
        }
        base.update(kwargs)
        return base
    return _make
