# Inbox Intel — Project Context

> A privacy-first, local AI email categorization dashboard powered by **LangGraph**, **Ollama**, and **React**.

---

## 1. Stack Used

### Backend
| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** | Core runtime |
| **FastAPI** | REST API server (port 8000) |
| **LangGraph** | LLM pipeline orchestration (state graph) |
| **Ollama** | Local LLM inference (port 11434) |
| **SQLite** | Local data persistence |
| **Pandas** | Data aggregation & stats |
| **Loguru** | Structured logging |
| **Rich** | Beautiful CLI output |
| **python-dotenv** | Environment configuration |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server (port 5173) |
| **Tailwind CSS** | Utility-first styling |
| **Recharts** | Data visualization (Bar, Pie, Timeline charts) |
| **Lucide React** | Icon library |
| **Streamlit** | Legacy Python dashboard (port 8501) |

### External APIs
| Service | Purpose |
|--------|---------|
| **Gmail API (OAuth2)** | Fetch unread emails |
| **Google OAuth2** | User authentication & authorization |

---

## 2. App Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Gmail API  │────▶│  LangGraph   │────▶│   Ollama    │────▶│   SQLite    │
│  (OAuth2)   │     │  Pipeline    │     │  (Local LLM)│     │   Database  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                              │                                    │
                              ▼                                    ▼
                       ┌──────────────┐                    ┌─────────────┐
                       │  FastAPI     │◀───────────────────│  React UI   │
                       │  (REST API)  │                    │  (Port 5173)│
                       └──────────────┘                    └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Streamlit   │
                       │  (Port 8501) │
                       └──────────────┘
```

### Detailed Flow
1. **Auth**: `auth/gmail_auth.py` handles Google OAuth2 → gets `token.json`
2. **Fetch**: `data/fetcher.py` calls Gmail API for unread emails
3. **Deduplicate**: `data/store.py` skips already-classified emails
4. **Parse**: `pipeline/nodes.py:parse_node` builds the LLM prompt
5. **Classify**: `pipeline/nodes.py:classify_node` sends prompt to Ollama, parses JSON
6. **Validate**: Enums check labels are valid; retry if not (max 3)
7. **Store**: `pipeline/nodes.py:store_node` saves to SQLite via `upsert_email()`
8. **Serve**: `api/server.py` exposes data via REST
9. **Display**: React dashboard fetches and visualizes

---

## 3. APIs / Routes

### FastAPI Endpoints (`api/server.py`)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/emails` | Returns all classified emails as JSON array |
| `GET` | `/api/stats` | Returns aggregated label counts per dimension |
| `GET` | `/api/health` | Health check — returns `{"status": "ok"}` |
| `POST` | `/api/classify` | Triggers full pipeline (fetch + classify new emails) |

### Gmail API Endpoints (via `googleapiclient`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `users().messages().list(q="is:unread")` | List unread message IDs |
| `GET` | `users().messages().get(format="full")` | Fetch full message details |

### Ollama API (Local)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `http://localhost:11434/api/chat` | Send classification prompt, get JSON response |

---

## 4. Auth Flow

### Google OAuth2 for Gmail (`auth/gmail_auth.py`)

```
User clicks / runs script
        │
        ▼
┌─────────────────┐
│ Check token.json│
│ exists?         │
└────────┬────────┘
         │
    Yes ─┴─► Load credentials ──► Valid? ──► Return service
         │                          │
         │                      No ─┘
         │                          │
         │    Expired? ──► Refresh ──► Save new token
         │                          │
         │                      No ──► Launch browser OAuth
         │                          │
         │    No token.json ────────► InstalledAppFlow
         │                          │
         │                          ▼
         │                   Browser opens localhost:8080
         │                          │
         │                          ▼
         │                   User grants Gmail readonly access
         │                          │
         │                          ▼
         │                   Save token.json to ~/.inbox-intel/
         │                          │
         └──────────────────────────┘
                              ▼
                        Return Gmail service object
```

### Scopes
- `https://www.googleapis.com/auth/gmail.readonly` — **Read-only** access to emails

### Credential Storage
- `~/.inbox-intel/credentials.json` — Google OAuth client secrets (user provides)
- `~/.inbox-intel/token.json` — OAuth refresh token (auto-generated)

---

## 5. Database Schema

### SQLite — `emails` Table (`data/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS emails (
    id              TEXT PRIMARY KEY,       -- Gmail message ID
    thread_id       TEXT,                   -- Gmail thread ID
    subject         TEXT,                   -- Email subject
    sender          TEXT,                   -- Display name
    sender_email    TEXT,                   -- Email address
    snippet         TEXT,                   -- Gmail snippet (preview)
    received_at     TEXT,                   -- Date string from headers
    email_type_label TEXT,                  -- SALES, SUPPORT, SPAM, MARKETING, GENERAL, INTERNAL
    action_label    TEXT,                   -- ACTION_REQUIRED, AWAITING_REPLY, FYI, REFERENCE
    dept_label      TEXT,                   -- HR_ADMIN, INTERNAL_PROJECT, EXTERNAL_CLIENT, IT_SYSTEMS, FINANCE
    priority_label  TEXT,                   -- URGENT, STANDARD, LOW_PRIORITY
    reason          TEXT,                   -- LLM explanation (1-2 sentences)
    classified_at   TEXT,                   -- ISO timestamp
    retry_count     INTEGER DEFAULT 0,      -- Number of retry attempts
    status          TEXT DEFAULT 'classified' -- 'classified' | 'failed'
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_email_type ON emails(email_type_label);
CREATE INDEX IF NOT EXISTS idx_priority   ON emails(priority_label);
CREATE INDEX IF NOT EXISTS idx_action     ON emails(action_label);
CREATE INDEX IF NOT EXISTS idx_dept       ON emails(dept_label);
```

### Data Flow Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  fetcher.py │────▶│  graph.py   │────▶│  store.py   │
│  (Gmail)    │     │  (LangGraph)│     │  (SQLite)   │
│  Raw dicts  │     │  EmailState │     │  upsert()   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  server.py  │
                                       │  (FastAPI)  │
                                       │  load_all() │
                                       └──────┬──────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  React UI   │
                                       │  (Recharts) │
                                       └─────────────┘
```

---

## 6. Dependencies

### Python (`requirements.txt`)

```
# Gmail
google-auth==2.29.0
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
google-api-python-client==2.127.0

# LangGraph + LangChain
langgraph>=0.2.16
langchain-core>=0.2.27,<0.3
langchain-community>=0.2.6,<0.3

# Ollama client
ollama==0.2.1

# Data
pandas==2.2.2
SQLAlchemy==2.0.30

# Dashboard
streamlit==1.35.0
plotly==5.22.0
streamlit-extras==0.4.3

# Utilities
python-dotenv==1.0.1
tenacity==8.3.0
loguru==0.7.2
rich==13.7.1
```

### Node.js (`react-dashboard/package.json` — inferred)

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "recharts": "^2.x",
    "lucide-react": "^0.x",
    "tailwindcss": "^3.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

### System Requirements
- **Python 3.11+**
- **Node.js** (for React dashboard)
- **Ollama** installed and running (`ollama serve`)
- **Google Cloud project** with Gmail API enabled + OAuth credentials

---

## 7. Completed Features

### Core Pipeline
- [x] Gmail OAuth2 authentication with token persistence
- [x] Fetch unread emails with full message details (headers + body)
- [x] LangGraph state graph with 3 nodes: `parse` → `classify` → `store`
- [x] Local LLM classification via Ollama (`phi3:mini` / `llama3`)
- [x] 4-dimension classification: Email Type, Action Intent, Department, Priority
- [x] Retry logic (max 3 attempts) with fallback labels on failure
- [x] SQLite persistence with `INSERT OR REPLACE` (idempotent)
- [x] Deduplication: skip already-classified emails

### API Layer
- [x] FastAPI REST server with CORS for React
- [x] `/api/emails` — list all emails
- [x] `/api/stats` — aggregated counts
- [x] `/api/health` — health check
- [x] `/api/classify` — trigger classification pipeline

### Dashboards
- [x] **React Dashboard** (modern):
  - [x] Dark/light mode toggle
  - [x] 6 metric cards (Total, Spam, Urgent, Action Required, Awaiting, Failed)
  - [x] 4 bar charts (Email Type, Action Intent, Department, Priority)
  - [x] 1 pie chart (Email Type Distribution)
  - [x] 1 stacked timeline bar (Emails by Day)
  - [x] Email list with color-coded tags
  - [x] Sort by Priority / Recent / Action Required
  - [x] Sidebar multi-select filters (all 4 dimensions)
  - [x] CSV export
  - [x] Refresh button (triggers re-classification)
- [x] **Streamlit Dashboard** (legacy):
  - [x] Same filters and charts using Plotly
  - [x] Inline re-classification button
  - [x] CSV download

### DevOps / Tooling
- [x] `scripts/setup.sh` — automated environment setup
- [x] `start.sh` — one-command multi-service launcher (macOS AppleScript)
- [x] `scripts/run.py` — CLI with `--fetch-only` and `--dash-only` flags
- [x] `.env` configuration support
- [x] Structured logging with Loguru
- [x] Rich CLI output with progress tables

---

## 8. Pending Issues

### Known Bugs
- [x] `venv/` directory is committed to Git (should be in `.gitignore`)
- [x] `start.sh` is macOS-only (AppleScript); no Linux/Windows equivalent
- [x] No graceful shutdown for Ollama/FastAPI when `start.sh` exits
- [x] Error handling in React dashboard is minimal (no retry on API failure)
- [x] `dashboard/app.py` sometimes fails to load on first run (import path issues)

### Performance
- [ ] No batching for Gmail API calls (fetches messages one-by-one)
- [ ] No pagination for `/api/emails` (loads entire DB into memory)
- [ ] SQLite is single-writer; concurrent classification + API reads may block
- [ ] No caching layer for stats (recomputed on every `/api/stats` call)

### Security
- [ ] No input sanitization on email snippets before sending to LLM
- [ ] No rate limiting on `/api/classify` endpoint
- [ ] OAuth token is stored as plain JSON (not encrypted at rest)
- [ ] No HTTPS in development (FastAPI runs on plain HTTP)

---

## 9. Pending Tasks / Roadmap

### Short Term
- [ ] Add `tests/` unit tests (only folder exists, no test files)
- [x] Add `.env.example` to repo (referenced in README but missing)
- [x] Remove `venv/` from Git and add to `.gitignore`
- [x] Add Linux/Windows startup scripts (cross-platform `start.sh`)
- [x] Add email body preview to React email cards
- [x] Add search functionality (by subject, sender, or reason)

### Medium Term
- [ ] Add pagination to `/api/emails` (cursor-based or offset)
- [ ] Add WebSocket support for real-time updates when new emails arrive
- [ ] Add email threading view (group by `thread_id`)
- [ ] Add user preferences (default filters, sort order)
- [ ] Add export to PDF/Excel (not just CSV)
- [ ] Add notification badges for urgent emails

### Long Term
- [ ] Support multiple email providers (Outlook, IMAP)
- [ ] Add user accounts & multi-tenancy
- [ ] Deploy to cloud (Docker containerization)
- [ ] Add model switching (support multiple Ollama models)
- [ ] Add custom classification rules (user-defined labels)
- [ ] Add email auto-reply suggestions using LLM
- [ ] Add analytics: email volume trends, response time tracking
- [ ] Mobile-responsive React dashboard optimization

### Architecture Improvements
- [ ] Add Redis/caching layer for stats
- [ ] Add background job queue (Celery/RQ) for classification
- [ ] Add database migrations (Alembic)
- [ ] Add API authentication (JWT tokens)
- [ ] Add request logging middleware
