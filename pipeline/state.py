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

    # ── HR Classification fields (set by HR pipeline) ─────────────────────────
    classification_mode:  Optional[str]      # "standard" or "hr"
    hr_category:          Optional[str]      # LEAVE_OD, PAYROLL_COMP, etc.
    hr_confidence:        Optional[float]    # 0.0 – 1.0
    hr_matched_keywords:  Optional[str]      # JSON array string
    hr_reasoning:         Optional[str]      # LLM explanation
    hr_prompt:            Optional[str]      # HR-specific prompt
    hr_raw_response:      Optional[str]      # Raw HR LLM response

