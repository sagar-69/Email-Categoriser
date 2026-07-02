"""
Gmail compose helpers — create and send drafts.

Requires the `gmail.compose` OAuth2 scope (covers drafts.create + drafts.send).
Does NOT require `gmail.send` or `gmail.modify`.

Usage:
    from auth.gmail_compose import gmail_create_draft, gmail_send_draft

    draft_id = gmail_create_draft(
        thread_id="...",
        to="recipient@example.com",
        subject="Re: Contract revision",
        body="Hi Priya, ...",
    )
    message_id = gmail_send_draft(draft_id)
"""

import base64
from email.mime.text import MIMEText

from loguru import logger

from auth.gmail_auth import get_gmail_service


def gmail_create_draft(
    thread_id: str,
    to: str,
    subject: str,
    body: str,
    owner_email: str | None = None,
) -> str:
    """
    Create a Gmail draft threaded into the specified conversation.

    Args:
        thread_id: Gmail thread ID to attach the draft to.
        to: Recipient email address.
        subject: Email subject (should include "Re: " prefix).
        body: Plain-text reply body.
        owner_email: Account to create the draft for.

    Returns:
        The Gmail draft ID (used later for send or cancel).
    """
    service = get_gmail_service(owner_email)

    # Build RFC 2822 message
    message = MIMEText(body, "plain", "utf-8")
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

    draft_body = {
        "message": {
            "raw": raw,
            "threadId": thread_id,
        }
    }

    draft = service.users().drafts().create(
        userId="me",
        body=draft_body,
    ).execute()

    draft_id = draft["id"]
    logger.info(
        "Created Gmail draft {} in thread {} for {}",
        draft_id, thread_id, owner_email or "default",
    )
    return draft_id


def gmail_send_draft(
    gmail_draft_id: str,
    owner_email: str | None = None,
) -> str:
    """
    Send a previously created Gmail draft.

    Args:
        gmail_draft_id: The draft ID returned by gmail_create_draft.
        owner_email: Account that owns the draft.

    Returns:
        The sent message ID.
    """
    service = get_gmail_service(owner_email)

    result = service.users().drafts().send(
        userId="me",
        body={"id": gmail_draft_id},
    ).execute()

    message_id = result.get("id", "")
    logger.info(
        "Sent Gmail draft {} → message {} for {}",
        gmail_draft_id, message_id, owner_email or "default",
    )
    return message_id
