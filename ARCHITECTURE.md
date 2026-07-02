# Inbox Intel — Architecture

> System architecture, layers, and design decisions for the Inbox Intel email classification platform.

---

## 1. System Overview

Inbox Intel is a **3-tier local application**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                             │
│  ┌─────────────────┐                                                        │
│  │  React Dashboard│                                                        │
│  │  (Port 5173)    │                                                        │
│  │  Vite + Tailwind│                                                        │
│  │  Recharts +     │                                                        │
│  │  Lucide Icons   │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │  HTTP GET/POST                                                  │
│           ▼                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API / SERVICE LAYER                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  FastAPI Server (Port 8000)                                             ││
│  │  ├── /api/emails               → data.store.load_all()                  ││
│  │  ├── /api/stats                → data.store.get_stats()                 ││
│  │  ├── /api/unread-count         → data.store.get_unread_count()          ││
│  │  ├── /api/health               → {"status": "ok"}                       ││
│  │  ├── PATCH /api/emails/{id}/read → data.store.mark_as_read()            ││
│  │  └── POST /api/classify        → scripts.run.run_classification()       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                                                 │
│           │  Python imports                                                 │
│           ▼                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                            PIPELINE / CORE LAYER                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  LangGraph Orchestration                                                ││
│  │  ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐        ││
│  │  │  START   │───▶│ parse_node  │───▶│classify_ │───▶│ store_   │        ││
│  │  │          │    │ (prompt)    │    │  node    │    │  node    │        ││
│  │  └──────────┘    └─────────────┘    └────┬─────┘    └────┬─────┘        ││
│  │                                           │               │             ││
│  │                              ┌────────────┘               │             ││
│  │                              │  (retry loop)              │             ││
│  │                              ▼  if status=="pending"      │             ││
│  │                           ┌────────────-─┐                │             ││
│  │                           │ classify_node│◄───────────────┘             ││
│  │                           │  (retry)     │                              ││
│  │                           └─────────────-┘                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                                                 │
│           │  HTTP POST                                                      │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Ollama Local LLM (Port 11434)                                          ││
│  │  Model: phi3:mini / llama3                                              ││
│  │  Temperature: 0.1 (low randomness)                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                                                                 │
│           │  Python imports                                                 │
│           ▼                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DATA / AUTH LAYER                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  auth/gmail.py  │    │  data/fetcher.py│    │  data/store.py          │  │
│  │  OAuth2 Flow    │    │  Gmail API      │    │  SQLite CRUD            │  │
│  │  Token mgmt     │    │  Message fetch  │    │  Schema init            │  │
│  │  ~/.inbox-intel/│    │  Body decode    │    │  Upsert / Load / Stats  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend / Backend Layers

### 2.1 Frontend Layer

#### React Dashboard (`react-dashboard/`)
```
src/
├── App.jsx              → Root component, mounts InboxDashboard
├── InboxDashboard.jsx   → Main dashboard (all logic + UI)
├── main.jsx             → ReactDOM entry point
├── index.css            → Tailwind base styles
├── App.css              → Component-specific styles
└── assets/              → Static assets (images, fonts)
```

**State Management (React Hooks)**:
```
useState: darkMode, data, loading, error, lastSync, sortBy
          selEmailType, selAction, selDept, selPriority

useEffect: fetch emails on mount

useMemo:   filtered (4-dimension filter)
           sorted (priority/recent/action sort)
           emailTypeData, actionData, deptData, priorityData (chart data)
           pieData, timelineData
           total, spamCount, urgentCount, actionCount, awaitingCount, failedCount

useCallback: loadEmails, handleRefresh, handleExport
```

**No external state library** — React's built-in hooks are sufficient because:
- The app is a single-page dashboard (no routing)
- All data comes from one API source
- Filtering/sorting is client-side on a small dataset (< 1000 emails)


### 2.2 Backend Layer

Backend is organized by responsibility:

auth/          → Authentication (Gmail OAuth2)
├── gmail_auth.py  → Multi-account OAuth logic
├── auth_jwt.py    → API token issuance
└── gmail_compose.py → Draft creation and sending (reply feature)

config/        → Central configuration & enums
├── settings.py    → Paths, Ollama config, Gmail scopes, Enums, Display maps

data/          → Data access layer
├── schema.sql     → SQLite DDL (emails, pending_sends, sent_replies)
├── store.py       → CRUD operations (upsert, load, stats)
└── fetcher.py     → Gmail API integration

pipeline/      → AI classification pipeline & Reply Service
├── state.py       → EmailState TypedDict (shared state object)
├── prompts.py     → LLM system prompt + user prompt builder
├── nodes.py       → 3 LangGraph node functions
├── graph.py       → Graph assembly + compile + runner functions
├── reply_service.py → On-demand draft generation + thread summarization
└── send_worker.py → Asyncio background loop for delayed sends

api/           → REST API layer
├── server.py      → FastAPI app (classification endpoints + background tasks)
└── reply.py       → Reply v2 endpoints (generate, queue-send, status, cancel)

scripts/       → CLI & automation
├── setup.sh       → Environment setup (venv, deps, Ollama model)
├── run.py         → CLI entry point (fetch + classify + dashboard)
└── start.sh       → Multi-service launcher (macOS)
```

---

## 3. Database Relationships

### 3.1 Entity: `emails`

SQLite is a **single-table design** — no foreign keys, no joins needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              emails TABLE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  id (PK)             │ TEXT │ Gmail message ID                                  │
│  thread_id           │ TEXT │ Gmail thread ID (for grouping conversations)      │
│  subject             │ TEXT │ Email subject line                                │
│  sender              │ TEXT │ Display name (e.g., "John Doe")                   │
│  sender_email        │ TEXT │ Email address (e.g., "john@example.com")          │
│  snippet             │ TEXT │ Gmail-generated preview text                      │
│  received_at         │ TEXT │ Date string from email headers                    │
│  email_type_label    │ TEXT │ FK-like: EmailTypeLabel enum                      │
│  action_label        │ TEXT │ FK-like: ActionLabel enum                         │
│  dept_label          │ TEXT │ FK-like: DepartmentLabel enum                     │
│  priority_label      │ TEXT │ FK-like: PriorityLabel enum                       │
│  reason              │ TEXT │ LLM explanation (free text)                         │
│  classified_at       │ TEXT │ ISO timestamp                                       │
│  retry_count         │ INT  │ Number of LLM retry attempts                        │
│  status              │ TEXT │ 'classified' | 'failed'                             │
│  classification_mode │ TEXT │ 'standard' | 'hr'                                   │
│  hr_category         │ TEXT │ HR sub-category                                     │
│  hr_confidence       │ REAL │ Keyword confidence                                  │
│  hr_matched_keywords │ TEXT │ JSON array of matched keywords                     │
│  hr_reasoning        │ TEXT │ HR-specific explanation                             │
│  is_read             │ INT  │ 0 = unread, 1 = read                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Why Single Table?

| Decision | Rationale |
|----------|-----------|
| **No foreign keys** | All labels are enums defined in Python (`config/settings.py`), not reference tables |
| **No joins** | Every query is a simple `SELECT * FROM emails` with `WHERE` on label columns |
| **Indexes on all label columns** | 4 indexes for O(1) filter performance |
| **No migrations needed** | Schema is simple; `init_db()` runs `CREATE TABLE IF NOT EXISTS` |

### 3.3 Data Access Patterns

```
Pattern 1: Load all emails (dashboard)
  SELECT * FROM emails ORDER BY received_at DESC

Pattern 2: Check duplicates (classification)
  SELECT id FROM emails

Pattern 3: Stats aggregation (charts)
  SELECT email_type_label, COUNT(*) FROM emails GROUP BY email_type_label

Pattern 4: Filtered view (React sidebar)
  Client-side filtering on loaded DataFrame (no DB query)
```

---

## 4. Reusable Services

### 4.1 Service: `data.store` (Data Access Service)

```python
def init_db() -> None              # Create tables

def upsert_email(record: dict)     # Insert or replace single record

def bulk_upsert(records: list)     # Batch insert

def load_all() -> pd.DataFrame     # Return all emails as DataFrame

def load_unread_ids() -> set       # Return set of existing IDs (dedup)

def get_stats() -> dict            # Return value_counts per label
```

**Reused by**: `pipeline/nodes.py`, `api/server.py`, `scripts/run.py`

### 4.2 Service: `auth.gmail_auth` (Authentication Service)

```python
def get_credentials() -> Credentials    # OAuth2 flow management

def get_gmail_service() -> Resource     # Authenticated Gmail API client
```

**Reused by**: `data/fetcher.py`

### 4.3 Service: `pipeline.graph` (Classification Service)

```python
def classify_email(email: dict) -> dict      # Single email classification

def classify_batch(emails: list) -> list     # Batch classification with progress
```

**Reused by**: `scripts/run.py`, `api/server.py`

### 4.4 Service: `config.settings` (Configuration Service)

Centralizes:
- File paths (`DB_PATH`, `TOKEN_PATH`, `CREDENTIALS_PATH`)
- Ollama config (`OLLAMA_MODEL`, `OLLAMA_TIMEOUT`)
- Gmail config (`GMAIL_SCOPES`, `MAX_EMAILS_PER_RUN`)
- **4 Enum classes** for label validation
- Display maps (label → human-readable)
- Color maps (label → hex color for UI)

**Reused by**: Nearly every module

### 4.5 Service: Export Capabilities

Both Standard and HR dashboards support exporting filtered and sorted email lists into various formats:
- **CSV**: Browser `Blob` download
- **Excel**: `xlsx` library
- **PDF**: `jspdf` + `jspdf-autotable`

---

## 5. State Management

### 5.1 LangGraph State (`pipeline/state.py`)

```typescript
interface EmailState {
  // Input fields (from Gmail)
  id: string
  thread_id: string
  subject: string
  sender: string
  sender_email: string
  snippet: string
  body_preview: string
  received_at: string

  // Intermediate (set by parse_node)
  prompt: string | null
  raw_response: string | null

  // Output (set by classify_node)
  email_type_label: string | null
  action_label: string | null
  dept_label: string | null
  priority_label: string | null
  reason: string | null

  // Control (managed by graph)
  retry_count: number
  status: "pending" | "classified" | "failed"
  error: string | null
}
```

**State Flow**:
```
Initial State (from fetcher)
    │
    ▼
parse_node:  adds "prompt", sets status="pending"
    │
    ▼
classify_node: adds labels + reason, sets status="classified" OR increments retry_count
    │
    ├── status="pending" ──► loop back to classify_node (retry)
    │
    ├── status="classified" ──► store_node
    │
    └── status="failed" ──► store_node (with fallback labels)
```

### 5.2 React State (`InboxDashboard.jsx`)

```
Global UI State:
  darkMode          → toggles Tailwind dark classes
  data              → raw standard emails from /api/emails
  hrData            → raw HR emails from /api/emails?mode=hr
  loading           → shows spinner
  error             → shows error card
  lastSync          → timestamp of last fetch
  unreadCounts      → { total, standard, hr } counts from API
  activeAccount     → currently selected Google account for JWT auth

Filter State:
  selEmailType      → multi-select filter (array of keys)
  selAction         → multi-select filter
  selDept           → multi-select filter
  selPriority       → multi-select filter

Sort State:
  sortBy            → 'Priority' | 'Most recent' | 'Action required first'
  hrSortBy          → 'Urgent First' | 'Most Recent First' | 'Action Required First'

Derived State (useMemo):
  filtered          → data filtered by 4 dimensions
  sorted            → filtered sorted by sortBy (or hrSortBy for HR mode)
  emailTypeData     → counts for bar chart
  actionData        → counts for bar chart
  deptData          → counts for bar chart
  priorityData      → counts for donut chart
  pieData           → same as emailTypeData (for pie)
  timelineData      → daily counts by priority (stacked bar)
  total, spamCount, urgentCount, actionCount, awaitingCount, failedCount
```

---

## 6. AI Service Abstraction

### 6.1 Ollama Abstraction Layer

The project abstracts the LLM behind a **simple function call** in `pipeline/nodes.py`:

```python
response = ollama_client.chat(
    model=OLLAMA_MODEL,                    # "llama3" or "phi3:mini"
    messages=[
        {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
        {"role": "user", "content": state["prompt"]},
    ],
    options={
        "temperature": 0.1,                 # Low randomness
        "num_predict": 256,               # Max tokens
    },
)
```

**Why this abstraction works**:
- Swapping models is a **config change** (`OLLAMA_MODEL` in `.env`)
- No LangChain wrappers needed — direct `ollama` client is simpler
- The prompt (`CLASSIFICATION_SYSTEM_PROMPT`) is the only "interface" the model needs to implement

### 6.2 Prompt Engineering as "Business Logic"

The prompt in `pipeline/prompts.py` is the **most critical file** in the system:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROMPT = BUSINESS LOGIC CONTRACT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Defines 4 label groups with descriptions + keywords + tone hints       │
│  2. Defines classification rules (sender domain priority, spam/marketing)    │
│  3. Defines output format (strict JSON with 5 keys)                        │
│  4. Enforces "no markdown, no preamble, no trailing text"                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Separation of Concerns**:
| Layer | Responsibility |
|-------|---------------|
| **Prompt** | Encodes domain expertise (what makes an email "urgent", "sales", etc.) |
| **Parser** (`json.loads`) | Validates structural correctness |
| **Validator** (`assert in Enum`) | Validates semantic correctness |
| **Retry Logic** | Handles transient failures |
| **Fallback** | Guarantees every email gets stored |

### 6.3 Model Swap Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  To swap LLM provider:                                                     │
│                                                                             │
│  1. Change OLLAMA_MODEL in .env                                            │
│  2. Ensure new model is pulled: ollama pull <model>                         │
│  3. Adjust temperature if needed (in nodes.py)                               │
│  4. Test classification accuracy                                           │
│                                                                             │
│  To swap to cloud LLM (e.g., OpenAI):                                       │
│                                                                             │
│  1. Replace ollama_client.chat() with openai.ChatCompletion.create()       │
│  2. Add API key to .env                                                     │
│  3. Update CLASSIFICATION_SYSTEM_PROMPT if model behaves differently       │
│  4. Update privacy docs (data now leaves local machine)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Shared AI Features Across Modes

Standard and HR dashboards share AI controls:
- **Ollama model switcher**: `/api/models`
- **Human-in-the-loop reply composer**: `DraftReplyPanel.jsx` triggers `/api/emails/{id}/generate-reply`, `/api/emails/{id}/queue-send`, `/api/pending-sends/{queue_id}`, and `/api/pending-sends/{queue_id}/cancel`.
- **Reply safety controls**: steering input, quick intent chips, editable draft, local edit highlighting, backend-confirmed delayed send, and real Undo before `drafts.send`.
- **Re-classification**: Refresh triggers `POST /api/classify` with the selected model.

---

## 7. API Flow

### 7.1 Classification Trigger Flow

```
User clicks "Refresh" in React
        │
        ▼
apiFetchWithAccountRetry() (handles JWT refresh if 401)
        │
        ▼
POST /api/classify  ──────────────────────►  FastAPI
        │                                      │
        │                                      ▼
        │                              scripts.run.run_classification()
        │                                      │
        │                                      ▼
        │                              data.fetcher.fetch_unread_emails()
        │                                      │
        │                                      ▼
        │                              data.store.load_unread_ids() (dedup)
        │                                      │
        │                                      ▼
        │                              pipeline.graph.classify_batch()
        │                                      │
        │                                      ▼
        │                              For each email:
        │                                ├── parse_node → build prompt
        │                                ├── classify_node → Ollama API
        │                                │   └── retry up to 3x if fail
        │                                └── store_node → SQLite
        │                                      │
        │                                      ▼
        │                              Return results
        │                                      │
        ◀──────────────────────────────────────┘
        │
        ▼
GET /api/emails  ─────────────────────────►  FastAPI
        │                                      │
        │                                      ▼
        │                              data.store.load_all()
        │                                      │
        │                                      ▼
        │                              Return JSON array
        │                                      │
        ◀──────────────────────────────────────┘
        │
        ▼
React re-renders with new data
```

### 7.2 Dashboard Load Flow

```
React mounts InboxDashboard
        │
        ▼
useEffect calls loadEmails()
        │
        ▼
GET /api/emails  ───────────────────────►  FastAPI
        │                                      │
        │                                      ▼
        │                              data.store.load_all()
        │                              → pd.read_sql_query()
        │                              → df.to_dict(orient="records")
        │                                      │
        ◀──────────────────────────────────────┘
        │
        ▼
useMemo computes:
  - filtered (apply 4 sidebar filters)
  - sorted (apply sort selection)
  - chartData (aggregate for Recharts)
  - stats (count metrics)
        │
        ▼
React renders: metrics → charts → email list
```

---

## 8. Component Interaction Diagram

```
                    ┌─────────────────┐
                    │   User Browser   │
                    │  (localhost:5173)│
                    └────────┬────────┘
                             │
               ┌──────────────┐
               │              │
               ▼              ▼
        ┌────────────┐ ┌────────────┐
        │  React UI  │ │   CLI      │
        │  (Vite)    │ │  (run.py)  │
        └─────┬──────┘ └─────┬──────┘
              │              │
              │  HTTP        │  Direct
              │  GET/POST    │  Python
              ▼              ▼
        ┌─────────────────────────────────────────┐
        │         FastAPI Server (8000)           │
        │  /api/emails  /api/stats  /api/classify │
        └─────────────────────────────────────────┘
             │              │              │
             │              │              │
             ▼              ▼              ▼
        ┌────────────┐ ┌────────────┐
        │data.store  │ │pipeline.   │
        │.load_all() │ │graph       │
        └─────┬──────┘ └─────┬──────┘
              │              │
             ▼              ▼              ▼
       ┌─────────────────────────────────────────┐
       │         SQLite Database                 │
       │         ~/.inbox-intel/emails.db        │
       └─────────────────────────────────────────┘
             ▲                              ▲
             │                              │
             │  Direct import               │  Direct import
             │                              │
       ┌────────────┐                ┌────────────┐
       │data.fetcher│                │auth.gmail  │
       │.fetch_unread│               │.get_service│
       └─────┬──────┘                └─────┬──────┘
             │                              │
             ▼                              ▼
       ┌────────────┐                ┌────────────┐
       │ Gmail API  │                │ Google     │
       │ (OAuth2)   │                │ OAuth2     │
       └────────────┘                └────────────┘
             ▲                              ▲
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
                     ┌────────────┐
                     │  Ollama    │
                     │ (Local LLM)│
                     │ :11434     │
                     └────────────┘
```

---

## 9. Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Privacy First** | All AI runs locally via Ollama; email content never leaves device |
| **Single Source of Truth** | SQLite is the only persistent store; all UIs read from it |
| **Fail-Safe** | Fallback labels on classification failure; retry logic prevents data loss |
| **Config-Driven** | All paths, models, limits in `.env` + `config/settings.py` |
| **Separation of Concerns** | Auth, fetch, classify, store, serve, display are independent modules |
| **Idempotency** | `INSERT OR REPLACE` + deduplication means re-running is safe |
| **Observability** | Loguru logging at every step; Rich CLI output for human readability |


     
