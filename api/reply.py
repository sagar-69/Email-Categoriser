"""
Reply v2 API endpoints — on-demand draft generation + delayed send queue.

Endpoints:
    POST /api/emails/{email_id}/generate-reply
    POST /api/emails/{email_id}/queue-send
    POST /api/pending-sends/{queue_id}/cancel
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from loguru import logger

from api.auth_jwt import get_current_user
from config.settings import OLLAMA_MODEL
from data.store import (
    load_email_record,
    enqueue_pending_send,
    cancel_pending_send,
)

router = APIRouter()

DELAY_SECONDS = 8  # how long the user has to undo


# ── Request models ───────────────────────────────────────────────────────────

class GenerateReplyRequest(BaseModel):
    instruction: str | None = None


class QueueSendRequest(BaseModel):
    text: str
    original_draft: str


# ── Generate reply ───────────────────────────────────────────────────────────

@router.post("/api/emails/{email_id}/generate-reply")
def generate_reply_endpoint(
    email_id: str,
    payload: GenerateReplyRequest = GenerateReplyRequest(),
    model_name: Optional[str] = Query(None, description="Override the Ollama model"),
    owner_email: Optional[str] = Query(None),
    _user: str = Depends(get_current_user),
):
    """
    Generate a single AI draft reply for the specified email.

    Optionally accepts a steering instruction (e.g. "politely decline",
    "ask for Monday instead") that overrides the default tone.

    Returns: { "draft": str, "model": str }
    """
    email = load_email_record(email_id, owner_email)
    if not email:
        raise HTTPException(status_code=404, detail=f"Email {email_id} not found.")

    # Lazy import to avoid circular deps at module load
    from pipeline.reply_service import generate_reply, get_thread_context

    # Fetch thread context (live from Gmail, not from DB)
    try:
        thread_context = get_thread_context(email_id, owner_email)
    except Exception as exc:
        logger.warning("Thread context fetch failed for {}: {}", email_id, exc)
        thread_context = []

    # Build email body from available fields
    email_body = email.get("body_preview") or email.get("snippet") or ""
    sender = f"{email.get('sender', '')} <{email.get('sender_email', '')}>"
    category = email.get("dept_label", "INTERNAL_PROJECT")
    model = model_name or OLLAMA_MODEL

    try:
        draft = generate_reply(
            email_body=email_body,
            subject=email.get("subject", "(no subject)"),
            sender=sender,
            category=category,
            thread_context=thread_context,
            steering_instruction=payload.instruction,
            model_name=model,
        )
        return {"draft": draft.draft_text, "model": draft.model_used}

    except Exception as exc:
        logger.error("Reply generation failed for {}: {}", email_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate reply: {str(exc)}",
        )


# ── Queue send (delayed) ────────────────────────────────────────────────────

@router.post("/api/emails/{email_id}/queue-send")
def queue_send_endpoint(
    email_id: str,
    payload: QueueSendRequest,
    owner_email: Optional[str] = Query(None),
    _user: str = Depends(get_current_user),
):
    """
    Save a real Gmail draft immediately, then schedule the actual send
    ~8 seconds later. Returns a queue_id the client uses to cancel.

    The Gmail draft is created right away via drafts.create so that
    even if the user closes the browser, the draft persists in Gmail.
    """
    email = load_email_record(email_id, owner_email)
    if not email:
        raise HTTPException(status_code=404, detail=f"Email {email_id} not found.")

    from auth.gmail_compose import gmail_create_draft

    subject = email.get("subject", "")
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    try:
        gmail_draft_id = gmail_create_draft(
            thread_id=email.get("thread_id", ""),
            to=email.get("sender_email", ""),
            subject=subject,
            body=payload.text,
            owner_email=owner_email,
        )
    except Exception as exc:
        logger.error("Failed to create Gmail draft for {}: {}", email_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create Gmail draft: {str(exc)}",
        )

    queue_id = enqueue_pending_send(
        email_id=email_id,
        gmail_draft_id=gmail_draft_id,
        draft_text=payload.original_draft,
        final_text=payload.text,
        delay_seconds=DELAY_SECONDS,
        owner_email=owner_email,
    )

    return {
        "queue_id": queue_id,
        "gmail_draft_id": gmail_draft_id,
        "delay_seconds": DELAY_SECONDS,
    }


# ── Cancel send ──────────────────────────────────────────────────────────────

@router.post("/api/pending-sends/{queue_id}/cancel")
def cancel_send_endpoint(
    queue_id: int,
    _user: str = Depends(get_current_user),
):
    """
    Cancel a scheduled send. The Gmail draft is left in place — nothing
    is lost, the user can still send it manually from Gmail or re-open
    it in Inbox Intel.

    Returns 409 if the send has already fired.
    """
    cancelled = cancel_pending_send(queue_id)
    if not cancelled:
        raise HTTPException(
            status_code=409,
            detail="Too late — already sent or already cancelled.",
        )
    return {"cancelled": True}
