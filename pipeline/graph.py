"""
Assembles and compiles the LangGraph email classification graph.

Graph flow:
    START → parse_node → classify_node → [retry?] → store_node → END

Conditional edge on classify_node:
    - status == "pending"    → classify_node (retry)
    - status == "classified" → store_node
    - status == "failed"     → store_node

HR Graph flow (parallel):
    START → hr_parse_node → hr_classify_node → [retry?] → hr_store_node → END
"""

from langgraph.graph import StateGraph, END
from pipeline.state import EmailState
from pipeline.nodes import parse_node, classify_node, store_node


def should_retry(state: EmailState) -> str:
    """
    Routing function for the conditional edge after classify_node.
    Returns the name of the next node.
    """
    if state.get("status") == "pending":
        return "classify_node"
    return "store_node"


def build_graph():
    """Build and compile the standard classification graph."""
    g = StateGraph(EmailState)

    g.add_node("parse_node",    parse_node)
    g.add_node("classify_node", classify_node)
    g.add_node("store_node",    store_node)

    g.set_entry_point("parse_node")
    g.add_edge("parse_node", "classify_node")
    g.add_conditional_edges("classify_node", should_retry)
    g.add_edge("store_node", END)

    return g.compile()


# Singleton graph instance — import this in the runner
email_graph = build_graph()


# ── HR Classification Graph ──────────────────────────────────────────────────

def _hr_should_retry(state: EmailState) -> str:
    """Routing function for the HR classify_node retry logic."""
    if state.get("status") == "pending":
        return "hr_classify_node"
    return "hr_store_node"


def _hr_store_node(state: EmailState) -> dict:
    """
    Persists the HR-classified email to SQLite.
    Includes both standard fallback labels and HR-specific fields.
    """
    from data.store import upsert_email
    record = {
        "id":                state["id"],
        "thread_id":         state.get("thread_id", ""),
        "subject":           state["subject"],
        "sender":            state["sender"],
        "sender_email":      state["sender_email"],
        "snippet":           state["snippet"],
        "body_preview":      state.get("body_preview", ""),
        "received_at":       state["received_at"],
        # Standard labels get neutral defaults for HR-classified emails
        "email_type_label":  state.get("email_type_label", "GENERAL"),
        "action_label":      state.get("action_label", "FYI"),
        "dept_label":        state.get("dept_label", "HR_ADMIN"),
        "priority_label":    state.get("priority_label", "STANDARD"),
        "reason":            state.get("hr_reasoning", ""),
        "retry_count":       state.get("retry_count", 0),
        "status":            state.get("status", "failed"),
        # HR-specific fields
        "hr_category":         state.get("hr_category", ""),
        "hr_confidence":       state.get("hr_confidence", 0.0),
        "hr_matched_keywords": state.get("hr_matched_keywords", "[]"),
        "classification_mode": "hr",
        "hr_reasoning":        state.get("hr_reasoning", ""),
        # Multi-account support
        "owner_email":         state.get("owner_email", None),
    }
    upsert_email(record)
    return {}


def build_hr_graph():
    """Build and compile the HR classification graph."""
    from pipeline.hr_nodes import hr_parse_node, hr_classify_node

    g = StateGraph(EmailState)

    g.add_node("hr_parse_node",    hr_parse_node)
    g.add_node("hr_classify_node", hr_classify_node)
    g.add_node("hr_store_node",    _hr_store_node)

    g.set_entry_point("hr_parse_node")
    g.add_edge("hr_parse_node", "hr_classify_node")
    g.add_conditional_edges("hr_classify_node", _hr_should_retry)
    g.add_edge("hr_store_node", END)

    return g.compile()


# Singleton HR graph instance
hr_email_graph = build_hr_graph()


# ── Dispatcher Functions ─────────────────────────────────────────────────────

def classify_email(email: dict, mode: str = "standard", owner_email: str | None = None) -> dict:
    """
    Run a single email through the appropriate pipeline.
    email: dict from fetcher.py
    mode: "standard" or "hr"
    Returns: final EmailState dict
    """
    initial_state: EmailState = {
        **email,
        "prompt":             None,
        "raw_response":       None,
        "email_type_label":   None,
        "action_label":       None,
        "dept_label":         None,
        "priority_label":     None,
        "reason":             None,
        "retry_count":        0,
        "status":             "pending",
        "error":              None,
        # HR fields
        "classification_mode": mode,
        "hr_category":         None,
        "hr_confidence":       None,
        "hr_matched_keywords": None,
        "hr_reasoning":        None,
        "hr_prompt":           None,
        "hr_raw_response":     None,
        # Multi-account support
        "owner_email":         owner_email,
    }

    if mode == "hr":
        return hr_email_graph.invoke(initial_state)
    return email_graph.invoke(initial_state)


def classify_batch(emails: list[dict], mode: str = "standard", owner_email: str | None = None) -> list[dict]:
    """
    Classify a batch of emails sequentially.
    Returns list of final states.
    """
    results = []
    total = len(emails)
    mode_label = "HR" if mode == "hr" else "Standard"
    for i, email in enumerate(emails, 1):
        print(f"\n  [{i}/{total}] [{mode_label}] Classifying: {email['subject'][:60]}")
        result = classify_email(email, mode=mode, owner_email=owner_email)

        if mode == "hr":
            if result.get("status") == "classified":
                print(f"      ↳ HR Category: {result.get('hr_category')} | Confidence: {result.get('hr_confidence', 0):.2f}")
                print(f"      ↳ Reasoning: {result.get('hr_reasoning')}")
            else:
                print(f"      ↳ [FAILED] {result.get('error')}")
        else:
            if result.get("status") == "classified":
                print(f"      ↳ Type: {result.get('email_type_label')} | Action: {result.get('action_label')} | Dept: {result.get('dept_label')} | Priority: {result.get('priority_label')}")
                print(f"      ↳ Reason: {result.get('reason')}")
            else:
                print(f"      ↳ [FAILED] {result.get('error')}")

        results.append(result)
    return results
