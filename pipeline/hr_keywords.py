"""
HR Keyword Dictionaries & Scoring Engine.

Provides keyword-based pre-filtering for the HR classification pipeline.
Each category maps to a list of trigger keywords scanned against
the email subject (2× weight) and body (1× weight).
"""

# ── HR Category Keyword Dictionaries ─────────────────────────────────────────

HR_KEYWORDS = {
    "LEAVE_OD": [
        "sick leave", "PTO request", "annual leave", "on duty", "comp off",
        "leave approval", "time off", "vacation", "medical leave",
        "casual leave", "emergency leave", "leave application",
    ],
    "PAYROLL_COMP": [
        "salary slip", "Form 16", "tax deduction", "provident fund",
        "reimbursement claim", "expense report", "payslip", "bonus",
        "increment", "CTC", "TDS", "ESIC", "gratuity", "allowance", "salary",
    ],
    "RECRUITMENT": [
        "resume", "CV attached", "interview schedule", "offer letter",
        "candidate feedback", "job application", "hiring", "onboarding new",
        "joining date", "background verification", "reference check",
        "recruitment",
    ],
    "OFFBOARDING": [
        "resignation", "notice period", "last working day", "F&F settlement",
        "clearance form", "exit interview", "relieving letter",
        "experience certificate", "handover", "separation", "resign",
    ],
    "HR_ADMIN": [
        "visa letter", "address proof", "bank letter",
        "employment certificate", "ID card", "policy update",
        "HR announcement", "attendance regularization", "shift change",
        "work from home", "HR policy", "certificate",
    ],
}

# Valid HR categories (including the special NON_HR sentinel)
VALID_HR_CATEGORIES = set(HR_KEYWORDS.keys()) | {"NON_HR"}


def keyword_classify(subject: str, body: str) -> dict:
    """
    Score an email against the 5 HR keyword dictionaries.

    Subject matches are weighted 2×, body matches are weighted 1×.

    Returns:
        {
            "category":         str,    # top scoring category
            "confidence":       float,  # 0.0 – 0.99
            "scores":           dict,   # {category: score, ...}
            "matched_keywords": list,   # keywords matched for the winner
        }
    """
    subject_lower = (subject or "").lower()
    body_lower = (body or "").lower()
    text = f"{subject_lower} {body_lower}"

    scores = {}
    matched_per_category = {}

    for category, keywords in HR_KEYWORDS.items():
        category_score = 0
        matched = []

        for kw in keywords:
            kw_lower = kw.lower()
            in_subject = kw_lower in subject_lower
            in_body = kw_lower in body_lower

            if in_subject:
                category_score += 2
                matched.append(kw)
            elif in_body:
                category_score += 1
                matched.append(kw)

        scores[category] = category_score
        matched_per_category[category] = matched

    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    total = sum(scores.values()) or 1
    winner = sorted_scores[0][0]
    winner_score = sorted_scores[0][1]

    # If no keywords matched at all, return NON_HR
    if winner_score == 0:
        return {
            "category": "NON_HR",
            "confidence": 0.0,
            "scores": dict(sorted_scores),
            "matched_keywords": [],
        }

    return {
        "category": winner,
        "confidence": min(winner_score / total, 0.99),
        "scores": dict(sorted_scores),
        "matched_keywords": matched_per_category[winner],
    }
