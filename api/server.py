"""
FastAPI server that exposes the SQLite email database as a REST API.

Runs on port 8000 alongside the existing Streamlit dashboard (8501)
and the React dashboard dev server (5173).

Security features:
  - Rate limiting on /api/classify (10-second cooldown)
  - CORS restricted to localhost dev servers

Performance features:
  - Pagination support on /api/emails via limit & offset params
"""

import sys
import time
from pathlib import Path
from typing import Optional

# Add project root to sys.path so we can import our modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from data.store import (
    load_all, get_stats, init_db, load_hr_emails, get_hr_stats,
    mark_as_read, get_unread_count, count_all,
)

app = FastAPI(title="Inbox Intel API", version="1.1.0")

# Allow the React dev server (port 5173) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ── Auth Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/auth/login")
def auth_login():
    """Redirect the user to Google's OAuth2 consent screen."""
    from auth.gmail_auth import get_auth_url
    try:
        auth_url = get_auth_url()
        return RedirectResponse(url=auth_url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/callback")
def auth_callback(code: str = Query(...), error: Optional[str] = Query(None)):
    """
    Handle the OAuth2 callback from Google.
    Exchanges the auth code for tokens, then redirects back to the React dashboard.
    """
    if error:
        return RedirectResponse(url=f"http://localhost:5173?auth_error={error}")

    from auth.gmail_auth import handle_auth_callback
    try:
        account_info = handle_auth_callback(code)
        email = account_info.get("email", "unknown")
        return RedirectResponse(url=f"http://localhost:5173?auth_email={email}")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:5173?auth_error={str(e)}")


@app.get("/api/auth/accounts")
def auth_accounts():
    """Return a list of authenticated Google account email addresses."""
    from auth.gmail_auth import list_authenticated_accounts
    return {"accounts": list_authenticated_accounts()}


@app.delete("/api/auth/accounts/{email}")
def auth_remove_account(email: str):
    """Remove a saved OAuth token for the given email."""
    from auth.gmail_auth import remove_account
    removed = remove_account(email)
    if not removed:
        raise HTTPException(status_code=404, detail=f"No token found for {email}")
    return {"status": "ok", "removed": email}


# ── Data Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/emails")
def list_emails(
    mode: Optional[str] = Query(None),
    owner_email: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Return classified emails as a list of dicts.
    Use ?mode=hr for HR emails.
    Use ?limit=50&offset=0 for pagination.
    """
    if mode == "hr":
        df = load_hr_emails(owner_email=owner_email, limit=limit, offset=offset)
    else:
        df = load_all(owner_email=owner_email, limit=limit, offset=offset)
    # Replace NaN with None for JSON serialization
    df = df.where(df.notnull(), None)
    total = count_all(owner_email=owner_email, mode=mode)
    return {
        "data": df.to_dict(orient="records"),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/stats")
def stats(mode: Optional[str] = Query(None), owner_email: Optional[str] = Query(None)):
    """Return aggregated label counts. Use ?mode=hr for HR stats."""
    if mode == "hr":
        return get_hr_stats(owner_email=owner_email)
    return get_stats(owner_email=owner_email)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/unread-count")
def unread_count(mode: Optional[str] = Query(None), owner_email: Optional[str] = Query(None)):
    """Return the number of unread emails, optionally filtered by mode and owner."""
    return {
        "total": get_unread_count(owner_email=owner_email),
        "standard": get_unread_count("standard", owner_email=owner_email),
        "hr": get_unread_count("hr", owner_email=owner_email),
    }


@app.patch("/api/emails/{email_id}/read")
def mark_email_read(email_id: str):
    """Mark a single email as read."""
    updated = mark_as_read(email_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Email not found")
    return {"status": "ok", "id": email_id}


class ClassifyRequest(BaseModel):
    mode: str = "standard"
    reclassify_all: bool = False
    owner_email: str | None = None


# ── Rate-limited classify endpoint ───────────────────────────────────────────
_last_classify_time: float = 0
_CLASSIFY_COOLDOWN: int = 10  # seconds


@app.post("/api/classify")
def classify(req: ClassifyRequest = ClassifyRequest()):
    """
    Trigger the classification pipeline to fetch and classify new emails.
    Rate-limited to one request per 10 seconds to protect the local Ollama instance.
    """
    global _last_classify_time
    now = time.time()
    if now - _last_classify_time < _CLASSIFY_COOLDOWN:
        remaining = int(_CLASSIFY_COOLDOWN - (now - _last_classify_time))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {remaining} seconds before classifying again.",
        )
    _last_classify_time = now

    from scripts.run import run_classification
    try:
        run_classification(
            mode=req.mode,
            reclassify_all=req.reclassify_all,
            owner_email=req.owner_email,
        )
        return {"status": "success", "message": f"Classification complete (mode: {req.mode})."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
