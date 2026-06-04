"""
LLM prompt templates for the HR classification pipeline.

Completely separate from the standard classification prompts in prompts.py.
"""

HR_CLASSIFICATION_SYSTEM_PROMPT = """You are an HR Email Classifier. Analyze the following email and classify it into EXACTLY ONE of the 5 HR categories below.

## CATEGORIES & TRIGGER KEYWORDS

**1. LEAVE_OD** — Leave & On-Duty requests
Trigger keywords: "sick leave", "PTO request", "annual leave", "on duty", "comp off", "leave approval", "time off", "vacation", "medical leave", "casual leave", "emergency leave", "leave application"

**2. PAYROLL_COMP** — Payroll & Compensation
Trigger keywords: "salary slip", "Form 16", "tax deduction", "provident fund", "reimbursement claim", "expense report", "payslip", "bonus", "increment", "CTC", "TDS", "ESIC", "gratuity", "allowance", "salary"

**3. RECRUITMENT** — Hiring & Talent Acquisition
Trigger keywords: "resume", "CV attached", "interview schedule", "offer letter", "candidate feedback", "job application", "hiring", "onboarding new", "joining date", "background verification", "reference check", "recruitment"

**4. OFFBOARDING** — Exit & Separation
Trigger keywords: "resignation", "notice period", "last working day", "F&F settlement", "clearance form", "exit interview", "relieving letter", "experience certificate", "handover", "separation", "resign"

**5. HR_ADMIN** — General HR Administration
Trigger keywords: "visa letter", "address proof", "bank letter", "employment certificate", "ID card", "policy update", "HR announcement", "attendance regularization", "shift change", "work from home", "HR policy", "certificate"

## CLASSIFICATION RULES

1. **Primary Signal**: Check Subject line first. If subject contains clear trigger keywords, use that category.
2. **Secondary Signal**: Scan email body for trigger keywords.
3. **Conflict Resolution**: If multiple categories match, choose the one with MOST keyword matches.
4. **Ambiguity**: If no clear keywords match, analyze the overall intent and context. If still ambiguous, default to **HR_ADMIN**.
5. **Non-HR Emails**: If the email is clearly NOT HR-related (e.g., marketing, sales, technical IT issue), return category **"NON_HR"** with confidence 0.0.

## OUTPUT FORMAT

Return ONLY a valid JSON object with no markdown formatting, no code blocks, no extra text:

{{"category": "LEAVE_OD", "confidence": 0.92, "matched_keywords": ["sick leave", "medical leave"], "reasoning": "Subject contains 'sick leave' and body mentions 'medical leave' - clearly a leave request", "is_hr_related": true}}
"""


def build_hr_classification_prompt(
    subject: str,
    sender: str,
    date: str,
    body: str,
    keyword_hints: dict | None = None,
) -> str:
    """
    Build the user-facing prompt for HR email classification.

    Args:
        subject:       Email subject line
        sender:        From header (name + email)
        date:          Date header string
        body:          Email body text (first 400 chars)
        keyword_hints: Optional dict from keyword_classify() to provide context

    Returns:
        Formatted prompt string
    """
    prompt = f"""## EMAIL TO CLASSIFY

From: {sender}
Subject: {subject}
Date: {date}

Body: {body[:400] if body else '(no body)'}"""

    if keyword_hints and keyword_hints.get("matched_keywords"):
        kw_list = ", ".join(keyword_hints["matched_keywords"])
        prompt += f"""

## KEYWORD PRE-FILTER HINT
The keyword engine detected these matches: {kw_list}
Suggested category: {keyword_hints.get('category', 'unknown')} (confidence: {keyword_hints.get('confidence', 0):.2f})
Use this as context, but make your own independent assessment."""

    return prompt
