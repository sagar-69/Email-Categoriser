"""Integration smoke test for the Gmail fetcher (mocked)."""

from unittest.mock import patch, MagicMock
from data.fetcher import fetch_unread_emails


@patch("data.fetcher.get_gmail_service")
def test_fetch_returns_list(mock_service):
    mock_svc = MagicMock()
    mock_service.return_value = mock_svc

    mock_svc.users().messages().list().execute.return_value = {
        "messages": [{"id": "abc123"}]
    }
    mock_svc.users().messages().get().execute.return_value = {
        "id": "abc123",
        "threadId": "t-abc",
        "snippet": "Test snippet",
        "payload": {
            "headers": [
                {"name": "Subject", "value": "Test Email"},
                {"name": "From",    "value": "Alice <alice@example.com>"},
                {"name": "Date",    "value": "Mon, 15 Jan 2024 10:00:00 +0000"},
            ],
            "body": {"data": ""}
        }
    }

    results = fetch_unread_emails(max_results=1)
    assert len(results) == 1
    assert results[0]["subject"] == "Test Email"
    assert results[0]["sender"]  == "Alice"
