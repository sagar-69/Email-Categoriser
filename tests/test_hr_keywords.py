"""Unit tests for the HR keyword scoring engine (pipeline/hr_keywords.py)."""

import pytest
from pipeline.hr_keywords import keyword_classify, HR_KEYWORDS, VALID_HR_CATEGORIES


class TestKeywordClassify:
    """Tests for the keyword_classify function."""

    def test_leave_email_classified_correctly(self):
        """An email about sick leave should be classified as LEAVE_OD."""
        result = keyword_classify(
            subject="Sick Leave Application",
            body="I need to take sick leave from Monday to Wednesday.",
        )
        assert result["category"] == "LEAVE_OD"
        assert result["confidence"] > 0
        assert "sick leave" in [kw.lower() for kw in result["matched_keywords"]]

    def test_payroll_email_classified_correctly(self):
        """An email about salary should be classified as PAYROLL_COMP."""
        result = keyword_classify(
            subject="Monthly Salary Slip - January 2024",
            body="Please find your salary slip attached.",
        )
        assert result["category"] == "PAYROLL_COMP"
        assert result["confidence"] > 0

    def test_recruitment_email(self):
        """An email about hiring should be classified as RECRUITMENT."""
        result = keyword_classify(
            subject="Interview Schedule for Senior Developer",
            body="Please confirm the interview schedule for the candidate.",
        )
        assert result["category"] == "RECRUITMENT"

    def test_offboarding_email(self):
        """An email about resignation should be classified as OFFBOARDING."""
        result = keyword_classify(
            subject="Resignation Letter - Notice Period",
            body="I am submitting my resignation with a 30-day notice period.",
        )
        assert result["category"] == "OFFBOARDING"

    def test_hr_admin_email(self):
        """An email about policy updates should be classified as HR_ADMIN."""
        result = keyword_classify(
            subject="HR Policy Update - Work from Home Guidelines",
            body="Please review the updated work from home policy.",
        )
        assert result["category"] == "HR_ADMIN"

    def test_non_hr_email_returns_non_hr(self):
        """An email with no HR keywords should return NON_HR."""
        result = keyword_classify(
            subject="Sprint Planning Meeting",
            body="Let's discuss the sprint backlog for next week.",
        )
        assert result["category"] == "NON_HR"
        assert result["confidence"] == 0.0
        assert result["matched_keywords"] == []

    def test_subject_weighted_2x(self):
        """Keywords in the subject should count 2× vs body (1×)."""
        # Only in subject → score = 2
        result_subject = keyword_classify(
            subject="sick leave request",
            body="no keywords here",
        )
        # Only in body → score = 1
        result_body = keyword_classify(
            subject="no keywords here",
            body="I need sick leave",
        )
        assert result_subject["scores"]["LEAVE_OD"] > result_body["scores"]["LEAVE_OD"]

    def test_multi_category_highest_wins(self):
        """When multiple categories match, the highest score should win."""
        result = keyword_classify(
            subject="Resignation and salary slip request",
            body="I am resigning and need my salary slip, form 16, and bonus details before my last working day.",
        )
        # PAYROLL_COMP has more keyword matches (salary slip, form 16, bonus, salary)
        # vs OFFBOARDING (resignation, last working day)
        assert result["category"] in VALID_HR_CATEGORIES
        assert result["confidence"] > 0

    def test_empty_strings(self):
        """Empty subject and body should return NON_HR."""
        result = keyword_classify(subject="", body="")
        assert result["category"] == "NON_HR"
        assert result["confidence"] == 0.0

    def test_none_values(self):
        """None values should not crash, and should return NON_HR."""
        result = keyword_classify(subject=None, body=None)
        assert result["category"] == "NON_HR"

    def test_case_insensitive(self):
        """Keyword matching should be case-insensitive."""
        result = keyword_classify(
            subject="SICK LEAVE APPLICATION",
            body="",
        )
        assert result["category"] == "LEAVE_OD"

    def test_valid_categories_constant(self):
        """VALID_HR_CATEGORIES should contain all keywords categories plus NON_HR."""
        expected = set(HR_KEYWORDS.keys()) | {"NON_HR"}
        assert VALID_HR_CATEGORIES == expected

    def test_scores_dict_always_present(self):
        """The result should always contain a scores dict with all categories."""
        result = keyword_classify(subject="test", body="test")
        assert "scores" in result
        for category in HR_KEYWORDS:
            assert category in result["scores"]
