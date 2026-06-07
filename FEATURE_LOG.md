# Inbox Intel — Feature Log

> Chronological record of features, refactors, system removals, dependency changes, and architecture updates.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ **Added** | New feature or system introduced |
| ❌ **Removed** | Feature or system deleted |
| 🔧 **Refactored** | Code restructured without behavior change |
| 📦 **Dependency** | New/updated/removed dependency |
| 🏗️ **Architecture** | Structural or design change |

---

## 2026

### June 2026

#### [🏗️] Architecture — Initial Project Structure
- **Date**: 2026-06-02
- **Change**: Established modular Python backend with 6 packages: `auth/`, `config/`, `data/`, `pipeline/`, `api/`, `scripts/`
- **Rationale**: Separation of concerns — each module has a single responsibility
- **Impact**: Enables independent testing, swapping, and scaling of each layer

#### [✅] Added — React Dashboard
- **Date**: 2026-06-02
- **Change**: Built modern frontend with React 18 + Vite + Tailwind CSS + Recharts + Lucide React
- **Features**: Dark/light mode, 6 metric cards, 4 bar charts, 1 pie chart, 1 stacked timeline, email list with color tags, sidebar filters, CSV export, refresh button
- **Rationale**: Streamlit is slow for large datasets; React provides better UX and interactivity
- **Impact**: Primary user interface; Streamlit becomes legacy/backup

#### [✅] Added — FastAPI REST Server
- **Date**: 2026-06-02
- **Change**: Created `api/server.py` with 4 endpoints: `/api/emails`, `/api/stats`, `/api/health`, `/api/classify`
- **Features**: CORS enabled for React dev server (port 5173), auto-generated OpenAPI docs
- **Rationale**: Bridge between Python backend and React frontend; enables decoupled architecture
- **Impact**: React dashboard can run independently from Python pipeline

#### [✅] Added — LangGraph Classification Pipeline
- **Date**: 2026-06-02
- **Change**: Implemented 3-node state graph: `parse_node` → `classify_node` → `store_node`
- **Features**: Conditional retry edge (loops back to `classify_node` if `status == "pending"`), max 3 retries, fallback labels on failure
- **Rationale**: LangGraph provides built-in state management, retry loops, and observability
- **Impact**: Core AI pipeline; all classification logic is orchestrated here

#### [✅] Added — Local LLM Integration (Ollama)
- **Date**: 2026-06-02
- **Change**: Integrated `ollama` Python client with `phi3:mini` and `llama3` models
- **Features**: Temperature 0.1, 256 max tokens, strict JSON output enforcement
- **Rationale**: Privacy-first — email content never leaves the local machine
- **Impact**: Replaces any cloud LLM dependency; zero API costs

#### [✅] Added — SQLite Persistence Layer
- **Date**: 2026-06-02
- **Change**: Created `data/schema.sql` with `emails` table + 4 indexes
- **Features**: `INSERT OR REPLACE` (idempotent), `load_all()` returns pandas DataFrame, `get_stats()` returns value_counts
- **Rationale**: Zero-config, file-based, portable — perfect for personal/local tools
- **Impact**: Single source of truth for all dashboards

#### [✅] Added — Gmail OAuth2 Authentication
- **Date**: 2026-06-02
- **Change**: Implemented `auth/gmail_auth.py` with full OAuth2 flow
- **Features**: Token persistence (`token.json`), auto-refresh, browser-based consent, `gmail.readonly` scope
- **Rationale**: Secure, standard way to access Gmail; read-only scope prevents accidental modifications
- **Impact**: Enables automated email fetching without manual credential entry

#### [✅] Added — Streamlit Dashboard (Legacy)
- **Date**: 2026-06-02
- **Change**: Built `dashboard/app.py` with Plotly charts
- **Features**: Sidebar multi-select filters, metric row, bar charts, timeline, email list with HTML tags, CSV export, inline re-classify
- **Rationale**: Rapid prototyping; works without Node.js build step
- **Impact**: Backup dashboard; useful for debugging and quick demos

#### [✅] Added — CLI Runner (`scripts/run.py`)
- **Date**: 2026-06-02
- **Change**: Created CLI entry point with argparse
- **Features**: `--fetch-only` (classify without dashboard), `--dash-only` (dashboard without classify), Rich summary table
- **Rationale**: Single command for development and testing; supports cron jobs
- **Impact**: Primary way to run the pipeline during development

#### [✅] Added — Setup & Launch Scripts
- **Date**: 2026-06-02
- **Change**: Created `scripts/setup.sh` and `start.sh`
- **Features**: `setup.sh` creates venv, installs deps, pulls Ollama model, initializes DB; `start.sh` opens 3 Terminal windows via AppleScript
- **Rationale**: One-command setup and launch for new users
- **Impact**: Reduces onboarding friction; `start.sh` is macOS-specific

#### [📦] Dependency — Python Stack
- **Date**: 2026-06-02
- **Added**: `google-auth`, `google-auth-oauthlib`, `google-api-python-client`, `langgraph`, `langchain-core`, `langchain-community`, `ollama`, `pandas`, `SQLAlchemy`, `streamlit`, `plotly`, `streamlit-extras`, `python-dotenv`, `tenacity`, `loguru`, `rich`
- **Rationale**: Each dependency serves a specific layer (auth, AI, data, dashboard, utilities)
- **Impact**: Locked versions for reproducibility; `langgraph>=0.2.16` allows minor updates

#### [📦] Dependency — Node.js Stack (React Dashboard)
- **Date**: 2026-06-02
- **Added**: `react`, `react-dom`, `recharts`, `lucide-react`, `tailwindcss`, `vite`, `@vitejs/plugin-react`
- **Rationale**: Modern frontend toolchain; Vite for fast HMR, Recharts for data viz, Tailwind for styling
- **Impact**: React dashboard is the primary UI; Streamlit is secondary

#### [🔧] Refactored — Configuration Centralization
- **Date**: 2026-06-02
- **Change**: Moved all config to `config/settings.py` with `python-dotenv`
- **Features**: Enums for all 4 label dimensions, display maps, color maps, path constants
- **Rationale**: Prevents magic strings; ensures consistency across backend and frontend
- **Impact**: Frontend color constants mirror backend exactly; label changes happen in one place

#### [🔧] Refactored — Prompt Engineering as Business Logic
- **Date**: 2026-06-02
- **Change**: Moved all LLM instructions to `pipeline/prompts.py`
- **Features**: 4 label group definitions, classification rules, strict JSON output format
- **Rationale**: The prompt is the "contract" between code and model; isolating it makes it maintainable
- **Impact**: Can tweak classification behavior without touching Python logic

#### [❌] Removed — `venv/` from Git
- **Date**: 2026-06-03
- **Change**: Added `venv/` to `.gitignore` and removed from repo
- **Rationale**: Virtual environments should not be committed
- **Impact**: Reduces repo size; prevents cross-platform issues

#### [✅] Added — `.env.example`
- **Date**: 2026-06-03
- **Change**: Created template `.env.example` with all required variables
- **Rationale**: Documented configuration options for new setups
- **Impact**: New users can easily configure their local environments

#### [🔧] Refactored — Cross-Platform & Graceful Startup
- **Date**: 2026-06-03
- **Change**: Replaced AppleScript in `start.sh` with bash traps, added `start-linux.sh` and `start-windows.bat`. Fixed `dashboard/app.py` import paths.
- **Rationale**: Enables easy running on all OSs and cleans up background processes.
- **Impact**: Better developer experience and no more hanging processes.

#### [✅] Added — Dashboard Search & Snippets
- **Date**: 2026-06-03
- **Change**: Added a real-time search bar, email body snippet previews, and graceful API error handling to the React UI.
- **Rationale**: Improves UX by making it easier to find and read emails without leaving the dashboard.
- **Impact**: React dashboard is more robust and fully featured.

#### [✅] Added — HR Classification Pipeline & Mode
- **Date**: 2026-06-04
- **Change**: Added a specialized HR classification pipeline using a consensus engine (keyword pre-filter + LLM).
- **Features**: New LangGraph nodes (`hr_nodes.py`), keyword classification (`hr_keywords.py`), separate prompts (`hr_prompts.py`), and a `ClassificationModeModal` in the React dashboard for toggling between Standard and HR classification modes.
- **Rationale**: Support domain-specific HR categorizations (Leave, Payroll, Recruitment, Offboard, Admin) with higher accuracy.
- **Impact**: Extends the platform to handle specific HR domain contexts alongside the standard 4-dimension classification.

#### [✅] Added — Read/Unread State Tracking
- **Date**: 2026-06-04
- **Change**: Introduced `is_read` column in SQLite with an index, and added `/api/emails/{id}/read` + `/api/unread-count` endpoints.
- **Features**: Frontend click-to-read functionality, optimistic UI updates, unread metric cards, and filtering to hide read emails from lists.
- **Rationale**: Users need to track which classified emails have been triaged.
- **Impact**: Improves workflow by removing triaged emails from the active dashboard view while keeping them in the database for stats.

---

## Pending / Planned Changes

### Short Term (Next 2 Weeks)

#### [📦] Dependency — Add Testing Framework
- **Planned**: Add `pytest` to `requirements.txt`
- **Rationale**: `tests/` folder exists but is empty
- **Impact**: Enables unit testing for nodes, fetcher, and store

### Medium Term (Next 1-2 Months)

#### [✅] Added — Pagination for `/api/emails`
- **Planned**: Add cursor-based or offset pagination
- **Rationale**: Currently loads entire DB into memory; will break at scale
- **Impact**: Supports thousands of emails without memory issues

#### [✅] Added — WebSocket Real-Time Updates
- **Planned**: Add WebSocket endpoint for live email notifications
- **Rationale**: Users currently must click "Refresh" to see new emails
- **Impact**: Dashboard updates automatically when new emails arrive

#### [✅] Added — Email Threading View
- **Planned**: Group emails by `thread_id` in the UI
- **Rationale**: Conversations are currently shown as individual emails
- **Impact**: Better UX for email threads and long conversations

#### [🏗️] Architecture — Background Job Queue
- **Planned**: Add Celery or RQ for asynchronous classification
- **Rationale**: Classification blocks the API during `POST /api/classify`
- **Impact**: Non-blocking API; classification runs in background

#### [🏗️] Architecture — Caching Layer
- **Planned**: Add Redis or in-memory caching for `/api/stats`
- **Rationale**: Stats are recomputed on every request; no data changes between classifications
- **Impact**: Faster dashboard load times

### Long Term (3-6 Months)

#### [🏗️] Architecture — Multi-Email Provider Support
- **Planned**: Abstract `data/fetcher.py` to support Outlook, IMAP, Exchange
- **Rationale**: Currently Gmail-only; limits user base
- **Impact**: Broader adoption; plugin-based fetcher architecture

#### [🏗️] Architecture — Docker Containerization
- **Planned**: Create `Dockerfile` and `docker-compose.yml`
- **Rationale**: Easier deployment; consistent environment across machines
- **Impact**: One-command deployment anywhere

#### [✅] Added — User Accounts & Multi-Tenancy
- **Planned**: Add JWT authentication, user table, per-user email DBs
- **Rationale**: Currently single-user; no concept of accounts
- **Impact**: SaaS potential; multiple users on one instance

#### [🏗️] Architecture — Database Migrations
- **Planned**: Add Alembic for schema versioning
- **Rationale**: SQLite schema is currently hardcoded; changes are risky
- **Impact**: Safe schema evolution as features grow

#### [✅] Added — Custom Classification Rules
- **Planned**: Allow users to define their own labels and rules
- **Rationale**: Current labels are hardcoded; not all users have the same needs
- **Impact**: Personalization; power-user feature

#### [🔧] Refactored — AI Service Abstraction
- **Planned**: Create `pipeline/llm_providers/` with adapters for Ollama, OpenAI, Anthropic
- **Rationale**: Currently Ollama-only; users may want cloud models for better accuracy
- **Impact**: Swappable LLM backend; config-driven provider selection

---

## Change Log Summary

| Date | Type | Description |
|------|------|-------------|
| 2026-06-02 | 🏗️ | Initial modular architecture (6 packages) |
| 2026-06-02 | ✅ | React dashboard (Vite + Tailwind + Recharts) |
| 2026-06-02 | ✅ | FastAPI REST server (4 endpoints) |
| 2026-06-02 | ✅ | LangGraph 3-node pipeline with retry logic |
| 2026-06-02 | ✅ | Ollama local LLM integration (phi3:mini/llama3) |
| 2026-06-02 | ✅ | SQLite persistence with 4 indexes |
| 2026-06-02 | ✅ | Gmail OAuth2 with token persistence |
| 2026-06-02 | ✅ | Streamlit legacy dashboard |
| 2026-06-02 | ✅ | CLI runner with Rich output |
| 2026-06-02 | ✅ | Setup & launch bash scripts |
| 2026-06-02 | 📦 | Python dependencies (15 packages) |
| 2026-06-02 | 📦 | Node.js dependencies (6 packages) |
| 2026-06-02 | 🔧 | Centralized config with enums & display maps |
| 2026-06-02 | 🔧 | Isolated prompt engineering in `prompts.py` |
| 2026-06-03 | ❌ | Remove `venv/` from Git |
| 2026-06-03 | ✅ | Add `.env.example` template |
| 2026-06-03 | 🔧 | Cross-platform startup scripts and graceful shutdown |
| 2026-06-03 | ✅ | React dashboard search, snippets, and error handling |
| 2026-06-04 | ✅ | HR classification pipeline and React dashboard mode modal |
| TBD | 📦 | Add pytest testing framework |
| TBD | ✅ | API pagination |
| TBD | ✅ | WebSocket real-time updates |
| TBD | ✅ | Email threading view |
| TBD | 🏗️ | Background job queue (Celery/RQ) |
| TBD | 🏗️ | Caching layer (Redis) |
| TBD | 🏗️ | Multi-provider fetcher abstraction |
| TBD | 🏗️ | Docker containerization |
| TBD | ✅ | User accounts & JWT auth |
| TBD | 🏗️ | Database migrations (Alembic) |
| TBD | ✅ | Custom classification rules |
| TBD | 🔧 | LLM provider abstraction (Ollama/OpenAI/Anthropic) |
