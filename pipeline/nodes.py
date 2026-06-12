"""
LangGraph node functions.

Each node receives an EmailState and returns a partial state update dict.
Nodes must be pure: they receive state, return updates, no side effects.
"""

import json
import re
from loguru import logger
import ollama as ollama_client

from config.settings import (
    OLLAMA_MODEL, OLLAMA_TIMEOUT, CLASSIFICATION_RETRIES,
    EmailTypeLabel, ActionLabel, DepartmentLabel, PriorityLabel
)
from pipeline.state import EmailState
from pipeline.prompts import CLASSIFICATION_SYSTEM_PROMPT, build_classification_prompt


# ── Input sanitization ────────────────────────────────────────────────────────

def _sanitize_text(text: str) -> str:
    """
    Strip potentially dangerous or misleading content from email text
    before sending it to the LLM for classification.
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


# ── Node 1: parse_node ────────────────────────────────────────────────────────

def parse_node(state: EmailState) -> dict:
    """
    Formats the classification prompt from the raw email fields.
    Sanitises inputs to strip HTML, zero-width chars, and prompt injection attempts.
    Sets: prompt
    """
    prompt = build_classification_prompt(
        subject=_sanitize_text(state["subject"]),
        sender=_sanitize_text(f"{state['sender']} <{state['sender_email']}>"),
        snippet=_sanitize_text(state["snippet"]),
    )
    logger.debug("parse_node: built prompt for email {}", state["id"])
    return {"prompt": prompt, "status": "pending"}


# ── Node 2: classify_node ─────────────────────────────────────────────────────

def classify_node(state: EmailState) -> dict:
    """
    Sends the formatted prompt to Ollama and parses the JSON response.
    On success: sets action_label, dept_label, priority_label, reason, status="classified"
    On failure: increments retry_count; if retries exhausted, sets status="failed"
    """
    retry_count = state.get("retry_count", 0)

    try:
        response = ollama_client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user",   "content": state["prompt"]},
            ],
            options={"temperature": 0.1, "num_predict": 256},
        )

        raw = response["message"]["content"].strip()
        logger.debug("classify_node: raw response = {}", raw[:200])

        # Strip markdown fences if model wraps in ```json ... ```
        cleaned = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
        parsed = json.loads(cleaned)

        # Validate enum values with safe fallbacks if LLM returns null
        email_type = (parsed.get("email_type") or "GENERAL").upper()
        action     = (parsed.get("action") or "FYI").upper()
        dept       = (parsed.get("department") or "INTERNAL_PROJECT").upper()
        priority   = (parsed.get("priority") or "STANDARD").upper()

        assert email_type in EmailTypeLabel.__members__, f"Invalid email_type: {email_type}"
        assert action     in ActionLabel.__members__,    f"Invalid action: {action}"
        assert dept       in DepartmentLabel.__members__, f"Invalid dept: {dept}"
        assert priority   in PriorityLabel.__members__,  f"Invalid priority: {priority}"

        logger.info(
            "Classified email {} → {} / {} / {} / {}",
            state["id"], email_type, action, dept, priority
        )

        return {
            "raw_response":      raw,
            "email_type_label":  email_type,
            "action_label":      action,
            "dept_label":        dept,
            "priority_label":    priority,
            "reason":            parsed.get("reason", ""),
            "status":            "classified",
            "retry_count":       retry_count,
        }

    except Exception as exc:
        logger.warning(
            "classify_node: attempt {} failed for email {}: {}",
            retry_count + 1, state["id"], exc
        )
        new_retry = retry_count + 1
        if new_retry >= CLASSIFICATION_RETRIES:
            logger.error("classify_node: giving up on email {} after {} retries.", state["id"], new_retry)
            return {
                "status":           "failed",
                "error":            str(exc),
                "retry_count":      new_retry,
                "email_type_label": "GENERAL",
                "action_label":     "FYI",
                "dept_label":       "INTERNAL_PROJECT",
                "priority_label":   "LOW_PRIORITY",
                "reason":           "Classification failed after max retries.",
            }
        return {"retry_count": new_retry, "status": "pending"}


# ── Node 3: store_node ────────────────────────────────────────────────────────

def store_node(state: EmailState) -> dict:
    """
    Persists the classified email to SQLite.
    Runs after classify_node completes (status == "classified" or "failed").
    """
    from data.store import upsert_email
    record = {
        "id":               state["id"],
        "thread_id":        state.get("thread_id", ""),
        "subject":          state["subject"],
        "sender":           state["sender"],
        "sender_email":     state["sender_email"],
        "snippet":          state["snippet"],
        "received_at":      state["received_at"],
        "email_type_label": state.get("email_type_label", ""),
        "action_label":     state.get("action_label", ""),
        "dept_label":       state.get("dept_label", ""),
        "priority_label":   state.get("priority_label", ""),
        "reason":           state.get("reason", ""),
        "retry_count":      state.get("retry_count", 0),
        "status":           state.get("status", "failed"),
        "owner_email":      state.get("owner_email", None),
    }
    upsert_email(record)
    return {}
