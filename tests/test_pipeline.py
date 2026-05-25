"""Unit tests for the classification pipeline nodes."""

import pytest
from unittest.mock import patch, MagicMock
from pipeline.nodes import parse_node, classify_node
from pipeline.state import EmailState


def make_state(**kwargs) -> EmailState:
    base = {
        "id": "test-001", "thread_id": "t-001",
        "subject": "Invoice overdue payment required",
        "sender": "Vendor Corp", "sender_email": "billing@vendor.com",
        "snippet": "Your invoice #4821 is 30 days overdue.",
        "body_preview": "", "received_at": "2024-01-15",
        "prompt": None, "raw_response": None,
        "action_label": None, "dept_label": None, "priority_label": None,
        "reason": None, "retry_count": 0, "status": "pending", "error": None,
    }
    base.update(kwargs)
    return base


def test_parse_node_sets_prompt():
    state = make_state()
    result = parse_node(state)
    assert "prompt" in result
    assert "Invoice overdue" in result["prompt"] or "invoice" in result["prompt"].lower()


@patch("pipeline.nodes.ollama_client.chat")
def test_classify_node_success(mock_chat):
    mock_chat.return_value = {
        "message": {
            "content": '{"action":"ACTION_REQUIRED","department":"FINANCE","priority":"URGENT","reason":"Overdue invoice."}'
        }
    }
    state = make_state(prompt="Subject: Invoice overdue\nFrom: vendor\nSnippet: overdue")
    result = classify_node(state)
    assert result["action_label"]   == "ACTION_REQUIRED"
    assert result["dept_label"]     == "FINANCE"
    assert result["priority_label"] == "URGENT"
    assert result["status"]         == "classified"


@patch("pipeline.nodes.ollama_client.chat")
def test_classify_node_retries_on_bad_json(mock_chat):
    mock_chat.return_value = {"message": {"content": "not valid json at all"}}
    state = make_state(prompt="test", retry_count=0)
    result = classify_node(state)
    assert result["retry_count"] == 1
    assert result["status"] == "pending"


@patch("pipeline.nodes.ollama_client.chat")
def test_classify_node_fails_after_max_retries(mock_chat):
    mock_chat.return_value = {"message": {"content": "bad json"}}
    state = make_state(prompt="test", retry_count=2)
    result = classify_node(state)
    assert result["status"] == "failed"
