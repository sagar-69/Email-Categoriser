"""
Assembles and compiles the LangGraph email classification graph.

Graph flow:
    START → parse_node → classify_node → [retry?] → store_node → END

Conditional edge on classify_node:
    - status == "pending"    → classify_node (retry)
    - status == "classified" → store_node
    - status == "failed"     → store_node
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
    """Build and compile the classification graph."""
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


def classify_email(email: dict) -> dict:
    """
    Run a single email through the pipeline.
    email: dict from fetcher.py
    Returns: final EmailState dict
    """
    initial_state: EmailState = {
        **email,
        "prompt":           None,
        "raw_response":     None,
        "email_type_label": None,
        "action_label":     None,
        "dept_label":       None,
        "priority_label":   None,
        "reason":           None,
        "retry_count":      0,
        "status":           "pending",
        "error":            None,
    }
    return email_graph.invoke(initial_state)


def classify_batch(emails: list[dict]) -> list[dict]:
    """
    Classify a batch of emails sequentially.
    Returns list of final states.
    """
    results = []
    total = len(emails)
    for i, email in enumerate(emails, 1):
        print(f"\n  [{i}/{total}] Classifying: {email['subject'][:60]}")
        result = classify_email(email)
        
        if result.get("status") == "classified":
            print(f"      ↳ Type: {result.get('email_type_label')} | Action: {result.get('action_label')} | Dept: {result.get('dept_label')} | Priority: {result.get('priority_label')}")
            print(f"      ↳ Reason: {result.get('reason')}")
        else:
            print(f"      ↳ [FAILED] {result.get('error')}")
            
        results.append(result)
    return results
