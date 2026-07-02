"""
On-demand reply generation service (v2).

Standalone from the classification LangGraph pipeline — this is a single
user-triggered action, not part of the batch ingestion flow.

Usage:
    from pipeline.reply_service import generate_reply, get_thread_context

    thread = get_thread_context(email_id, owner_email)
    draft  = generate_reply(
        email_body="...",
        subject="...",
        sender="...",
        category="EXTERNAL_CLIENT",
        thread_context=thread,
        steering_instruction="politely decline",
    )
    print(draft.draft_text)
"""

import base64
import re
from dataclasses import dataclass

from loguru import logger
import ollama as ollama_client

from config.settings import OLLAMA_MODEL
from pipeline.prompts import build_reply_prompt

# ── Token budget for thread context ──────────────────────────────────────────
MAX_THREAD_TOKENS = 1500  # rough estimate: 1 token ≈ 4 chars


def _estimate_tokens(texts: list[str]) -> int:
    """Rough token estimate: total chars / 4."""
    return sum(len(t) for t in texts) // 4


def _sanitize_text(text: str) -> str:
    """
    Strip potentially dangerous content from email text before prompting.
    Mirrors the sanitizer in pipeline/nodes.py.
    """
    if not text:
        return ""
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove zero-width characters
    text = re.sub(r'[\u200b-\u200f\ufeff\u00ad]', '', text)
    # Neutralise common prompt injection patterns
    text = re.sub(
        r'(?i)(ignore\s+previous|system\s+prompt|you\s+are\s+now|disregard\s+above|forget\s+instructions)',
        '[FILTERED]',
        text,
    )
    return text.strip()


# ── Reply generation ─────────────────────────────────────────────────────────

@dataclass
class ReplyDraft:
    """Result of a single reply generation."""
    draft_text: str
    model_used: str


def generate_reply(
    email_body: str,
    subject: str,
    sender: str,
    category: str,
    thread_context: list[str] | None = None,
    steering_instruction: str | None = None,
    model_name: str | None = None,
) -> ReplyDraft:
    """
    Generate a single draft reply using the local Ollama LLM.

    Args:
        email_body: The full body text of the email being replied to.
        subject: Email subject line.
        sender: Display name + email of the sender.
        category: Classification dept_label (e.g. EXTERNAL_CLIENT).
        thread_context: Ordered list of prior messages in the thread (oldest first).
        steering_instruction: Optional user intent (e.g. "politely decline").
        model_name: Override the default Ollama model.

    Returns:
        ReplyDraft with the generated text and the model used.
    """
    model = model_name or OLLAMA_MODEL

    prompt = build_reply_prompt(
        email_body=_sanitize_text(email_body),
        subject=_sanitize_text(subject),
        sender=_sanitize_text(sender),
        category=category,
        thread_context=thread_context or [],
        steering_instruction=steering_instruction,
    )

    logger.info(
        "Generating reply for '{}' from {} (model={}, steering={})",
        subject[:60], sender, model,
        steering_instruction[:40] if steering_instruction else "none",
    )

    response = ollama_client.chat(
        model=model,
        messages=[
            {"role": "user", "content": prompt},
        ],
        options={"temperature": 0.7, "num_predict": 512},
    )

    draft_text = response["message"]["content"].strip()
    logger.debug("Reply draft generated ({} chars)", len(draft_text))

    return ReplyDraft(draft_text=draft_text, model_used=model)


# ── Thread context ───────────────────────────────────────────────────────────

def _decode_message_body(payload: dict) -> str:
    """Extract plain-text body from a Gmail message payload."""
    if "body" in payload and payload["body"].get("data"):
        return base64.urlsafe_b64decode(
            payload["body"]["data"]
        ).decode("utf-8", errors="replace")
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part["body"].get("data"):
                return base64.urlsafe_b64decode(
                    part["body"]["data"]
                ).decode("utf-8", errors="replace")
    return ""


def _get_header(headers: list, name: str) -> str:
    """Get a single header value by name."""
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def get_thread_context(
    email_id: str,
    owner_email: str | None = None,
) -> list[str]:
    """
    Fetch the full email thread from Gmail and return context strings.

    Strategy:
      - Fetch the thread containing `email_id` via threads.get()
      - Keep the last 2 messages verbatim
      - If older messages exceed MAX_THREAD_TOKENS, summarize them
        with a cheap LLM call instead of dropping them
      - Return list of strings, oldest first

    The current email (email_id) is excluded from the context since
    the caller already has its body.
    """
    from auth.gmail_auth import get_gmail_service
    from data.store import load_email_record

    # Look up the thread_id for this email
    record = load_email_record(email_id, owner_email)
    if not record or not record.get("thread_id"):
        logger.debug("No thread_id found for email {}", email_id)
        return []

    thread_id = record["thread_id"]

    try:
        service = get_gmail_service(owner_email)
        thread = service.users().threads().get(
            userId="me",
            id=thread_id,
            format="full",
        ).execute()
    except Exception as exc:
        logger.warning("Failed to fetch thread {}: {}", thread_id, exc)
        return []

    messages = thread.get("messages", [])
    if len(messages) <= 1:
        # Single-message thread — no prior context
        return []

    # Build context strings for all messages EXCEPT the current one
    context_parts = []
    for msg in messages:
        if msg["id"] == email_id:
            continue
        headers = msg.get("payload", {}).get("headers", [])
        sender = _get_header(headers, "From")
        subject = _get_header(headers, "Subject")
        body = _decode_message_body(msg.get("payload", {}))
        # Truncate individual messages to prevent massive context
        body_trimmed = body[:2000] if body else "(no body)"
        context_parts.append(
            f"From: {sender}\nSubject: {subject}\n{body_trimmed}"
        )

    if not context_parts:
        return []

    # Split into recent (last 2) and older
    recent = context_parts[-2:]
    older = context_parts[:-2]

    if not older:
        return recent

    # Check token budget for older messages
    if _estimate_tokens(older) <= MAX_THREAD_TOKENS:
        return older + recent

    # Summarize older messages to stay within budget
    logger.info(
        "Thread {} has {} older messages exceeding token budget — summarizing",
        thread_id, len(older),
    )
    try:
        summary_response = ollama_client.chat(
            model=OLLAMA_MODEL,
            messages=[{
                "role": "user",
                "content": (
                    "Summarize the key facts, commitments, and numbers agreed "
                    "in this email thread in 3-4 sentences:\n\n"
                    + "\n---\n".join(older)
                ),
            }],
            options={"temperature": 0.3, "num_predict": 256},
        )
        summary = summary_response["message"]["content"].strip()
        return [f"[Earlier thread summary]: {summary}"] + recent
    except Exception as exc:
        logger.warning("Thread summarization failed: {}", exc)
        # Fall back to just the recent messages
        return recent
