"""
FastAPI server that exposes the SQLite email database as a REST API.

Runs on port 8000 alongside the existing Streamlit dashboard (8501)
and the React dashboard dev server (5173).
"""

import sys
from pathlib import Path

# Add project root to sys.path so we can import our modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from data.store import load_all, get_stats, init_db

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
def list_emails():
    """Return all classified emails as a list of dicts."""
    df = load_all()
    # Replace NaN with None for JSON serialization
    df = df.where(df.notnull(), None)
    return df.to_dict(orient="records")


@app.get("/api/stats")
def stats():
    """Return aggregated label counts."""
    return get_stats()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/classify")
def classify():
    """Trigger the classification pipeline to fetch and classify new emails."""
    from scripts.run import run_classification
    try:
        run_classification()
        return {"status": "success", "message": "Classification complete."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
