"""
Gmail fetcher: pulls unread messages in batches and normalises them
into flat dicts ready for the classification pipeline.
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


def fetch_unread_emails(max_results: int = MAX_EMAILS_PER_RUN, owner_email: str | None = None) -> list[dict]:
    """
    Fetch unread emails from Gmail.

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

    logger.info("Found {} unread messages. Fetching details...", len(messages))

    emails = []
    for msg_meta in messages:
        try:
            msg = service.users().messages().get(
                userId="me",
                id=msg_meta["id"],
                format="full"
            ).execute()

            headers = msg.get("payload", {}).get("headers", [])
            subject  = _get_header(headers, "Subject") or "(no subject)"
            raw_from = _get_header(headers, "From")    or ""
            date_str = _get_header(headers, "Date")    or ""

            sender_name, sender_email = _parse_sender(raw_from)
            body_text = _decode_body(msg.get("payload", {}))
            snippet   = msg.get("snippet", "")[:300]

            emails.append({
                "id":           msg["id"],
                "thread_id":    msg.get("threadId", ""),
                "subject":      subject,
                "sender":       sender_name,
                "sender_email": sender_email,
                "snippet":      snippet,
                "body_preview": body_text[:400],
                "received_at":  date_str,
            })
        except Exception as exc:
            logger.warning("Failed to fetch message {}: {}", msg_meta["id"], exc)
            continue

    logger.info("Successfully fetched {} email details.", len(emails))
    return emails
