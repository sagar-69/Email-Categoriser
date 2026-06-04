"""
LangGraph node functions for the HR classification pipeline.

Completely separate from the standard classification nodes in nodes.py.
Each node receives an EmailState and returns a partial state update dict.
"""

import json
import re
from loguru import logger
import ollama as ollama_client

from config.settings import OLLAMA_MODEL, OLLAMA_TIMEOUT, CLASSIFICATION_RETRIES
from pipeline.hr_keywords import keyword_classify, VALID_HR_CATEGORIES
from pipeline.hr_prompts import HR_CLASSIFICATION_SYSTEM_PROMPT, build_hr_classification_prompt


def resolve_classification(kw_result: dict, llm_result: dict) -> dict:
    """
    Consensus logic: merge keyword engine and LLM results.

    Rules:
    1. Keyword winner == LLM category → use that, confidence = max(both)
    2. Disagree + LLM confidence > 0.85 → trust LLM (high confidence override)
    3. Disagree + LLM confidence < 0.50 → trust keyword winner
    4. Both uncertain → default to HR_ADMIN, flag for review

    Special: LLM returns NON_HR + keyword score = 0 → mark as NON_HR
    """
    kw_category = kw_result.get("category", "NON_HR")
    kw_confidence = kw_result.get("confidence", 0.0)

    llm_category = llm_result.get("category", "HR_ADMIN")
    llm_confidence = llm_result.get("confidence", 0.0)
    llm_reasoning = llm_result.get("reasoning", "")
    llm_keywords = llm_result.get("matched_keywords", [])

    # Combine matched keywords from both engines
    all_keywords = list(set(kw_result.get("matched_keywords", []) + llm_keywords))

    # Special case: both say NON_HR
    if kw_category == "NON_HR" and llm_category == "NON_HR":
        return {
            "category": "NON_HR",
            "confidence": 0.0,
            "matched_keywords": [],
            "reasoning": llm_reasoning or "Email is not HR-related.",
        }

    # Special case: LLM says NON_HR but keywords found matches
    if llm_category == "NON_HR" and kw_category != "NON_HR":
        # Trust keywords if they found something
        return {
            "category": kw_category,
            "confidence": kw_confidence * 0.8,  # reduce confidence slightly
            "matched_keywords": all_keywords,
            "reasoning": f"Keywords suggest {kw_category} but LLM was uncertain. {llm_reasoning}",
        }

    # Rule 1: Agreement
    if kw_category == llm_category:
        return {
            "category": llm_category,
            "confidence": max(kw_confidence, llm_confidence),
            "matched_keywords": all_keywords,
            "reasoning": llm_reasoning,
        }

    # Rule 2: Disagree + LLM high confidence
    if llm_confidence > 0.85:
        return {
            "category": llm_category,
            "confidence": llm_confidence,
            "matched_keywords": all_keywords,
            "reasoning": f"LLM override (high confidence): {llm_reasoning}",
        }

    # Rule 3: Disagree + LLM low confidence
    if llm_confidence < 0.50:
        return {
            "category": kw_category,
            "confidence": kw_confidence,
            "matched_keywords": all_keywords,
            "reasoning": f"Keyword engine preferred (LLM uncertain). LLM said: {llm_reasoning}",
        }

    # Rule 4: Both uncertain
    return {
        "category": "HR_ADMIN",
        "confidence": max(kw_confidence, llm_confidence) * 0.7,
        "matched_keywords": all_keywords,
        "reasoning": f"Ambiguous classification — defaulted to HR_ADMIN. Keyword: {kw_category}, LLM: {llm_category}. {llm_reasoning}",
    }


# ── Node 1: hr_parse_node ─────────────────────────────────────────────────────

def hr_parse_node(state: dict) -> dict:
    """
    Formats the HR classification prompt and runs keyword pre-filter.
    Sets: hr_prompt, keyword pre-filter results in state
    """
    subject = state.get("subject", "")
    body = state.get("body_preview", "") or state.get("snippet", "")

    # Run keyword pre-filter
    kw_result = keyword_classify(subject, body)
    logger.debug(
        "hr_parse_node: keyword result for email {} → {} (conf={:.2f})",
        state["id"], kw_result["category"], kw_result["confidence"],
    )

    # Build LLM prompt with keyword hints
    prompt = build_hr_classification_prompt(
        subject=subject,
        sender=f"{state.get('sender', '')} <{state.get('sender_email', '')}>",
        date=state.get("received_at", ""),
        body=body,
        keyword_hints=kw_result,
    )

    return {
        "hr_prompt": prompt,
        "status": "pending",
        # Stash keyword result in state for consensus later
        "_kw_result": kw_result,
    }


# ── Node 2: hr_classify_node ──────────────────────────────────────────────────

def hr_classify_node(state: dict) -> dict:
    """
    Sends the HR prompt to Ollama, parses JSON, and runs consensus logic.
    On success: sets hr_category, hr_confidence, hr_reasoning, etc.
    On failure: increments retry_count; if retries exhausted, falls back to keyword result.
    """
    retry_count = state.get("retry_count", 0)
    kw_result = state.get("_kw_result", {"category": "HR_ADMIN", "confidence": 0.0, "matched_keywords": []})

    try:
        response = ollama_client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": HR_CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user",   "content": state["hr_prompt"]},
            ],
            options={"temperature": 0.1, "num_predict": 256},
        )

        raw = response["message"]["content"].strip()
        logger.debug("hr_classify_node: raw response = {}", raw[:200])

        # Strip markdown fences if model wraps in ```json ... ```
        cleaned = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
        parsed = json.loads(cleaned)

        # Extract LLM result
        llm_category = parsed.get("category", "HR_ADMIN").upper()
        llm_confidence = float(parsed.get("confidence", 0.5))
        llm_reasoning = parsed.get("reasoning", "")
        llm_keywords = parsed.get("matched_keywords", [])

        # Validate category
        if llm_category not in VALID_HR_CATEGORIES:
            logger.warning("hr_classify_node: invalid category '{}', defaulting to HR_ADMIN", llm_category)
            llm_category = "HR_ADMIN"

        llm_result = {
            "category": llm_category,
            "confidence": max(0.0, min(1.0, llm_confidence)),
            "reasoning": llm_reasoning,
            "matched_keywords": llm_keywords if isinstance(llm_keywords, list) else [],
        }

        # Run consensus logic
        final = resolve_classification(kw_result, llm_result)

        logger.info(
            "HR Classified email {} → {} (conf={:.2f})",
            state["id"], final["category"], final["confidence"],
        )

        return {
            "hr_raw_response":    raw,
            "hr_category":        final["category"],
            "hr_confidence":      final["confidence"],
            "hr_matched_keywords": json.dumps(final.get("matched_keywords", [])),
            "hr_reasoning":       final.get("reasoning", ""),
            "classification_mode": "hr",
            "status":             "classified",
            "retry_count":        retry_count,
        }

    except Exception as exc:
        logger.warning(
            "hr_classify_node: attempt {} failed for email {}: {}",
            retry_count + 1, state["id"], exc,
        )
        new_retry = retry_count + 1
        if new_retry >= CLASSIFICATION_RETRIES:
            logger.error("hr_classify_node: giving up on email {} after {} retries.", state["id"], new_retry)
            # Fall back to keyword result
            return {
                "status":              "failed",
                "error":               str(exc),
                "retry_count":         new_retry,
                "hr_category":         kw_result.get("category", "HR_ADMIN"),
                "hr_confidence":       kw_result.get("confidence", 0.0),
                "hr_matched_keywords": json.dumps(kw_result.get("matched_keywords", [])),
                "hr_reasoning":        f"LLM failed after {new_retry} retries. Fell back to keyword classification.",
                "classification_mode": "hr",
            }
        return {"retry_count": new_retry, "status": "pending"}
