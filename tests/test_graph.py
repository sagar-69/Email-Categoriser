"""Unit tests for the LangGraph routing logic (pipeline/graph.py)."""

import pytest
from pipeline.graph import should_retry, _hr_should_retry


class TestShouldRetry:
    """Tests for the standard graph routing function."""

    def test_pending_retries(self):
        """When status is 'pending', should route back to classify_node."""
        state = {"status": "pending"}
        assert should_retry(state) == "classify_node"

    def test_classified_goes_to_store(self):
        """When status is 'classified', should route to store_node."""
        state = {"status": "classified"}
        assert should_retry(state) == "store_node"

    def test_failed_goes_to_store(self):
        """When status is 'failed', should route to store_node."""
        state = {"status": "failed"}
        assert should_retry(state) == "store_node"

    def test_missing_status_goes_to_store(self):
        """When status is missing, should default to store_node."""
        state = {}
        assert should_retry(state) == "store_node"

    def test_unknown_status_goes_to_store(self):
        """Any unknown status should default to store_node."""
        state = {"status": "some_unknown_status"}
        assert should_retry(state) == "store_node"


class TestHrShouldRetry:
    """Tests for the HR graph routing function."""

    def test_pending_retries(self):
        """When status is 'pending', should route to hr_classify_node."""
        state = {"status": "pending"}
        assert _hr_should_retry(state) == "hr_classify_node"

    def test_classified_goes_to_store(self):
        """When status is 'classified', should route to hr_store_node."""
        state = {"status": "classified"}
        assert _hr_should_retry(state) == "hr_store_node"

    def test_failed_goes_to_store(self):
        """When status is 'failed', should route to hr_store_node."""
        state = {"status": "failed"}
        assert _hr_should_retry(state) == "hr_store_node"
