"""
EmailState — the single shared state object that flows through
every node in the LangGraph pipeline.
"""

from typing import Optional
from typing_extensions import TypedDict


class EmailState(TypedDict):
    # ── Input fields (set by fetch stage) ────────────────────────────────────
    id:             str
    thread_id:      str
    subject:        str
    sender:         str
    sender_email:   str
    snippet:        str
    body_preview:   str
    received_at:    str

    # ── Intermediate fields (set by parse node) ───────────────────────────────
    prompt:         Optional[str]         # Formatted prompt sent to Ollama
    raw_response:   Optional[str]         # Raw text from Ollama

    # ── Output fields (set by classify node) ─────────────────────────────────
    email_type_label: Optional[str]    # One of EmailTypeLabel
    action_label:   Optional[str]         # One of ActionLabel
    dept_label:     Optional[str]         # One of DepartmentLabel
    priority_label: Optional[str]         # One of PriorityLabel
    reason:         Optional[str]         # 1-2 sentence explanation from LLM

    # ── Control fields ────────────────────────────────────────────────────────
    retry_count:    int                   # Number of classify retries so far
    status:         str                   # "pending" | "classified" | "failed"
    error:          Optional[str]         # Error message if status == "failed"
