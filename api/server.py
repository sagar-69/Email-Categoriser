"""
FastAPI server that exposes the SQLite email database as a REST API.

Runs on port 8000 alongside the existing Streamlit dashboard (8501)
and the React dashboard dev server (5173).
"""

import sys
from pathlib import Path
from typing import Optional

# Add project root to sys.path so we can import our modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from data.store import load_all, get_stats, init_db, load_hr_emails, get_hr_stats

app = FastAPI(title="Inbox Intel API", version="1.0.0")

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


@app.get("/api/emails")
def list_emails(mode: Optional[str] = Query(None)):
    """Return classified emails as a list of dicts. Use ?mode=hr for HR emails."""
    if mode == "hr":
        df = load_hr_emails()
    else:
        df = load_all()
    # Replace NaN with None for JSON serialization
    df = df.where(df.notnull(), None)
    return df.to_dict(orient="records")


@app.get("/api/stats")
def stats(mode: Optional[str] = Query(None)):
    """Return aggregated label counts. Use ?mode=hr for HR stats."""
    if mode == "hr":
        return get_hr_stats()
    return get_stats()


@app.get("/api/health")
def health():
    return {"status": "ok"}


class ClassifyRequest(BaseModel):
    mode: str = "standard"
    reclassify_all: bool = False


@app.post("/api/classify")
def classify(req: ClassifyRequest = ClassifyRequest()):
    """Trigger the classification pipeline to fetch and classify new emails."""
    from scripts.run import run_classification
    try:
        run_classification(mode=req.mode, reclassify_all=req.reclassify_all)
        return {"status": "success", "message": f"Classification complete (mode: {req.mode})."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

