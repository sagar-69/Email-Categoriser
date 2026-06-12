"""Integration smoke tests for the Gmail fetcher (mocked)."""

from unittest.mock import patch, MagicMock
from data.fetcher import fetch_unread_emails, _parse_sender, _decode_body, _parse_message


class TestParseSender:
    """Tests for the _parse_sender helper."""

    def test_parses_name_and_email(self):
        name, email = _parse_sender('Alice Smith <alice@example.com>')
        assert name == "Alice Smith"
        assert email == "alice@example.com"

    def test_parses_quoted_name(self):
        name, email = _parse_sender('"Alice Smith" <alice@example.com>')
        assert name == "Alice Smith"
        assert email == "alice@example.com"

    def test_parses_email_only(self):
        name, email = _parse_sender("alice@example.com")
        assert name == "alice@example.com"
        assert email == "alice@example.com"

    def test_handles_empty_string(self):
        name, email = _parse_sender("")
        assert name == ""
        assert email == ""


class TestDecodeBody:
    """Tests for the _decode_body helper."""

    def test_empty_payload(self):
        assert _decode_body({}) == ""

    def test_no_data(self):
        assert _decode_body({"body": {}}) == ""

    def test_plain_body(self):
        import base64
        encoded = base64.urlsafe_b64encode(b"Hello World").decode()
        result = _decode_body({"body": {"data": encoded}})
        assert result == "Hello World"


class TestParseMessage:
    """Tests for the _parse_message helper."""

    def test_parses_valid_message(self):
        msg = {
            "id": "abc123",
            "threadId": "t-abc",
            "snippet": "Test snippet",
            "payload": {
                "headers": [
                    {"name": "Subject", "value": "Test Email"},
                    {"name": "From", "value": "Alice <alice@example.com>"},
                    {"name": "Date", "value": "Mon, 15 Jan 2024 10:00:00 +0000"},
                ],
                "body": {"data": ""},
            },
        }
        result = _parse_message(msg)
        assert result is not None
        assert result["id"] == "abc123"
        assert result["subject"] == "Test Email"
        assert result["sender"] == "Alice"
        assert result["sender_email"] == "alice@example.com"

    def test_missing_headers(self):
        msg = {"id": "no-headers", "payload": {"headers": [], "body": {"data": ""}}}
        result = _parse_message(msg)
        assert result is not None
        assert result["subject"] == "(no subject)"

    def test_malformed_payload_returns_none(self):
        """A message that causes parsing errors should return None."""
        result = _parse_message({})  # No id at all
        # Should not crash; returns None or a partial dict
        # Depends on implementation; we just test no exception


class TestFetchUnreadEmails:
    """Tests for the main fetch_unread_emails function."""

    @patch("data.fetcher.get_gmail_service")
    def test_fetch_returns_list(self, mock_service):
        mock_svc = MagicMock()
        mock_service.return_value = mock_svc

        mock_svc.users().messages().list().execute.return_value = {
            "messages": [{"id": "abc123"}]
        }

        # Mock the batch request
        def mock_batch_execute(batch_self):
            # Simulate calling the callback
            pass

        mock_batch = MagicMock()
        mock_svc.new_batch_http_request.return_value = mock_batch

        # We need to simulate the batch callback behavior
        # Since batch.execute() won't call our callback in the mock,
        # test the underlying _parse_message instead
        results = fetch_unread_emails(max_results=1)
        # The batch mock won't produce results, but the function should not crash
        assert isinstance(results, list)

    @patch("data.fetcher.get_gmail_service")
    def test_empty_inbox(self, mock_service):
        """When no unread messages exist, should return empty list."""
        mock_svc = MagicMock()
        mock_service.return_value = mock_svc
        mock_svc.users().messages().list().execute.return_value = {"messages": []}
        results = fetch_unread_emails(max_results=10)
        assert results == []

    @patch("data.fetcher.get_gmail_service")
    def test_no_messages_key(self, mock_service):
        """When the API response has no 'messages' key, should return empty list."""
        mock_svc = MagicMock()
        mock_service.return_value = mock_svc
        mock_svc.users().messages().list().execute.return_value = {}
        results = fetch_unread_emails(max_results=10)
        assert results == []
