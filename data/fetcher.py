"""
Gmail fetcher: pulls unread messages in batches and normalises them
into flat dicts ready for the classification pipeline.

Uses the Google API Client's BatchHttpRequest to fetch all message
details in a single HTTP round-trip instead of one-by-one.
"""

import base64
import re
from datetime import datetime, timezone
from loguru import logger

from config.settings import MAX_EMAILS_PER_RUN
from auth.gmail_auth import get_gmail_service


def _decode_body(payload: dict) -> str:
    """Extract a plain-text snippet from the message payload."""
    if "body" in payload and payload["body"].get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part["body"].get("data"):
                return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
    return ""


def _get_header(headers: list, name: str) -> str:
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _parse_sender(raw_sender: str) -> tuple[str, str]:
    """Return (display_name, email_address) from a raw From header."""
    match = re.match(r'^(.*?)\s*<(.+?)>$', raw_sender.strip())
    if match:
        return match.group(1).strip().strip('"'), match.group(2).strip()
    return raw_sender.strip(), raw_sender.strip()


def _received_at(msg: dict, fallback_date: str) -> str:
    """Prefer Gmail's internal timestamp; fall back to the Date header."""
    internal_date = msg.get("internalDate")
    if internal_date:
        try:
            timestamp = int(internal_date) / 1000
            return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
        except (TypeError, ValueError):
            pass
    return fallback_date


def _parse_message(msg: dict) -> dict | None:
    """Parse a single Gmail API message response into a flat dict."""
    try:
        headers = msg.get("payload", {}).get("headers", [])
        subject  = _get_header(headers, "Subject") or "(no subject)"
        raw_from = _get_header(headers, "From")    or ""
        date_str = _get_header(headers, "Date")    or ""

        sender_name, sender_email = _parse_sender(raw_from)
        body_text = _decode_body(msg.get("payload", {}))
        snippet   = msg.get("snippet", "")[:300]

        return {
            "id":           msg["id"],
            "thread_id":    msg.get("threadId", ""),
            "subject":      subject,
            "sender":       sender_name,
            "sender_email": sender_email,
            "snippet":      snippet,
            "body_preview": body_text[:400],
            "received_at":  _received_at(msg, date_str),
        }
    except Exception as exc:
        logger.warning("Failed to parse message {}: {}", msg.get("id", "?"), exc)
        return None


def fetch_unread_emails(max_results: int = MAX_EMAILS_PER_RUN, owner_email: str | None = None) -> list[dict]:
    """
    Fetch unread emails from Gmail using batched API requests.

    Returns a list of flat dicts:
        id, thread_id, subject, sender, sender_email,
        snippet, received_at, body_preview (first 400 chars)
    """
    service = get_gmail_service(owner_email)
    logger.info("Fetching up to {} unread emails...", max_results)

    # Step 1: list message IDs
    response = service.users().messages().list(
        userId="me",
        q="is:unread",
        maxResults=max_results
    ).execute()

    messages = response.get("messages", [])
    if not messages:
        logger.info("No unread messages found.")
        return []

    logger.info("Found {} unread messages. Fetching details via batch API...", len(messages))

    # Step 2: batch-fetch all message details
    emails = []
    errors = []

    def _batch_callback(request_id, response, exception):
        """Callback for each message in the batch."""
        if exception is not None:
            logger.warning("Batch fetch failed for request {}: {}", request_id, exception)
            errors.append(request_id)
            return
        parsed = _parse_message(response)
        if parsed:
            emails.append(parsed)

    # Google API allows max 100 requests per batch — split if needed
    BATCH_SIZE = 100
    for i in range(0, len(messages), BATCH_SIZE):
        chunk = messages[i:i + BATCH_SIZE]
        batch = service.new_batch_http_request(callback=_batch_callback)

        for msg_meta in chunk:
            batch.add(
                service.users().messages().get(
                    userId="me",
                    id=msg_meta["id"],
                    format="full"
                ),
                request_id=msg_meta["id"],
            )

        batch.execute()

    if errors:
        logger.warning("{} messages failed during batch fetch.", len(errors))

    logger.info("Successfully fetched {} email details.", len(emails))
    return emails
