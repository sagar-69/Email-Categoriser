<div align="center">

# 🧠✉️ Inbox Intel

**Privacy-first, local AI email categorization**

*Your emails. Your AI. Your machine.*

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-black?style=flat)](https://ollama.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Screenshots](#-screenshots) • [Contributing](#-contributing)

</div>

---

## 🎯 What is Inbox Intel?

**Inbox Intel** connects to your Gmail, fetches unread emails, and uses a **local Large Language Model** to automatically categorize them into actionable labels — all without your email data ever leaving your device.

> 🔒 **Your emails are never sent to OpenAI, Anthropic, or any cloud API.** All AI processing happens locally via [Ollama](https://ollama.com/).

### How It Works

```
Gmail API ──► LangGraph Pipeline ──► Ollama (Local LLM) ──► SQLite ──► React Dashboard
     │              │                      │                    │            │
     │              │                      │                    │            ▼
     │              │                      │                    │      📊 Charts & Filters
     │              │                      │                    │
     │              │                      │                    ▼
     │              │                      │              💾 Local Database
     │              │                      │
     │              │                      ▼
     │              │              🤖 AI Classification
     │              │                 (phi3:mini / llama3)
     │              │
     │              ▼
     │       📝 Parse & Prompt
     │
     ▼
📧 Fetch Unread Emails
```

---

## 🚀 Features

### 🔐 Privacy-First
- **100% local AI inference** — No data leaves your machine
- **Read-only Gmail access** — Cannot send, delete, or modify emails
- **Local SQLite database** — All data stays on your device
- **Secure credential storage** — OAuth tokens outside the repo in `~/.inbox-intel/`

### 🤖 AI-Powered Classification
Every email is automatically labeled across **4 dimensions**:

| Dimension | Labels |
|-----------|--------|
| **📧 Email Type** | `SALES` · `SUPPORT` · `SPAM` · `MARKETING` · `GENERAL` · `INTERNAL` |
| **⚡ Action Intent** | `ACTION_REQUIRED` · `AWAITING_REPLY` · `FYI` · `REFERENCE` |
| **🏢 Department** | `HR_ADMIN` · `INTERNAL_PROJECT` · `EXTERNAL_CLIENT` · `IT_SYSTEMS` · `FINANCE` |
| **🔥 Priority** | `URGENT` · `STANDARD` · `LOW_PRIORITY` |

### 📊 Modern React Dashboard
- **Dark/Light mode** toggle
- **6 live metric cards** — Total, Spam, Urgent, Action Required, Awaiting Reply, Failed
- **6 interactive charts** — Bar charts, pie chart, stacked timeline
- **Smart filtering** — Multi-select sidebar filters for all 4 dimensions
- **Sorting** — By priority (urgent first), most recent, or action required
- **CSV export** — Download your classified emails
- **One-click refresh** — Trigger re-classification from the UI

### 🛠️ Developer-Friendly
- **LangGraph orchestration** — Retry loops, state management, observability
- **FastAPI backend** — Auto-generated OpenAPI docs, CORS-enabled
- **CLI runner** — `python scripts/run.py --fetch-only` for cron jobs
- **Rich logging** — Beautiful terminal output with progress tables
- **Dual dashboards** — React (modern) + Streamlit (legacy/debug)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌─────────────────┐    ┌─────────────────┐                                 │
│  │  React Dashboard │    │ Streamlit App   │  (Legacy / Alternative)         │
│  │  (Port 5173)    │    │  (Port 8501)    │                                 │
│  │  Vite + Tailwind│    │  Plotly Charts  │                                 │
│  │  Recharts +     │    │  Inline Re-classify│                              │
│  │  Lucide Icons   │    │                 │                                 │
│  └────────┬────────┘    └────────┬────────┘                                 │
│           │                      │                                           │
│           │  HTTP GET/POST       │  Direct Python import                      │
│           ▼                      ▼                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API / SERVICE LAYER                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  FastAPI Server (Port 8000)                                           │ │
│  │  ├── /api/emails     → data.store.load_all()                          │ │
│  │  ├── /api/stats      → data.store.get_stats()                         │ │
│  │  ├── /api/health     → {"status": "ok"}                               │ │
│  │  └── /api/classify   → scripts.run.run_classification()              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           │  Python imports                                                  │
│           ▼                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                            PIPELINE / CORE LAYER                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  LangGraph Orchestration                                               │ │
│  │  ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐      │ │
│  │  │  START   │───▶│ parse_node  │───▶│classify_ │───▶│ store_   │      │ │
│  │  │          │    │ (prompt)   │    │  node    │    │  node    │      │ │
│  │  └──────────┘    └─────────────┘    └────┬─────┘    └────┬─────┘      │ │
│  │                                           │               │            │ │
│  │                              ┌────────────┘               │            │ │
│  │                              │  (retry loop)              │            │ │
│  │                              ▼  if status=="pending"    │            │ │
│  │                           ┌─────────────┐                │            │ │
│  │                           │ classify_node│◄───────────────┘            │ │
│  │                           │  (retry)    │                             │ │
│  │                           └─────────────┘                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           │  HTTP POST                                                       │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Ollama Local LLM (Port 11434)                                         │ │
│  │  Model: phi3:mini / llama3                                              │ │
│  │  Temperature: 0.1 (low randomness)                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                  │
│           │  Python imports                                                  │
│           ▼                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DATA / AUTH LAYER                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐   │
│  │  auth/gmail.py  │    │  data/fetcher.py│    │  data/store.py          │   │
│  │  OAuth2 Flow    │    │  Gmail API      │    │  SQLite CRUD            │   │
│  │  Token mgmt     │    │  Message fetch  │    │  Schema init            │   │
│  │  ~/.inbox-intel/│    │  Body decode    │    │  Upsert / Load / Stats  │   │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
inbox-intel/
├── api/                        # FastAPI REST Server
│   └── server.py
├── auth/                       # OAuth2 flow for Gmail API
│   └── gmail_auth.py
├── config/                     # Central config and enums
│   └── settings.py
├── dashboard/                  # Legacy Streamlit App
│   └── app.py
├── data/                       # SQLite helpers & Fetcher
│   ├── schema.sql
│   ├── store.py
│   └── fetcher.py
├── pipeline/                   # LangGraph Orchestration
│   ├── graph.py                # Graph assembly
│   ├── nodes.py                # Node functions
│   ├── prompts.py              # LLM prompts
│   └── state.py                # Shared state TypedDict
├── react-dashboard/            # Modern Frontend (Vite + React)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── InboxDashboard.jsx  # Main dashboard component
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
├── scripts/
│   ├── setup.sh                # Initial setup
│   └── run.py                  # CLI runner
├── tests/                      # Unit tests (placeholder)
├── start.sh                    # Multi-service launcher (macOS)
├── requirements.txt
└── .env                        # Environment variables (create from .env.example)
```

---

## ⚡ Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js** (for React Dashboard)
- **Ollama** installed and running (`ollama serve`)
- A **Google Cloud project** with the Gmail API enabled and OAuth credentials downloaded

### 1. Clone & Setup

```bash
git clone https://github.com/sagar-69/Email-Categoriser.git
cd Email-Categoriser

# Run the setup script (creates venv, installs deps, pulls Ollama model)
bash scripts/setup.sh
```

### 2. Setup React Dashboard

```bash
cd react-dashboard
npm install
cd ..
```

### 3. Configure Google OAuth

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Google OAuth `CLIENT_ID` and `CLIENT_SECRET`.

3. Place your downloaded `credentials.json` in `~/.inbox-intel/`.

### 4. Run Everything

We provide a convenient bash script that opens three terminal windows to run **Ollama**, the **FastAPI server**, and the **React Dashboard** simultaneously:

```bash
bash start.sh
```

> **Note:** The first time the backend runs, it will open your browser for Google OAuth consent. After authorizing, it will fetch and classify your emails.

**Open your browser to:** [http://localhost:5173](http://localhost:5173)

---

## 💻 CLI Commands

You can run individual parts of the application using the CLI:

| Command | Effect |
|---------|--------|
| `bash start.sh` | Starts Ollama, FastAPI, and React Dashboard |
| `python scripts/run.py` | Run LangGraph classification + open Streamlit |
| `python scripts/run.py --fetch-only` | Run classification in background |
| `streamlit run dashboard/app.py` | Open Streamlit dashboard only |
| `cd react-dashboard && npm run dev` | Run React dashboard dev server |
| `pytest tests/` | Run unit tests |

---

## 📊 Dashboard Preview

### React Dashboard
- **Live metrics** showing email counts by category
- **Interactive charts** powered by Recharts
- **Color-coded email cards** with all 4 classification labels
- **Sidebar filters** to drill down by type, action, department, or priority
- **Dark mode** for late-night email triage

### Streamlit Dashboard (Legacy)
- Same filtering and charting capabilities
- Inline re-classification button
- CSV export functionality
- Great for debugging and quick demos

---

## 🔒 Privacy Guarantee

| Feature | Implementation |
|--------|----------------|
| **Local AI Inference** | All LLM processing runs entirely locally on your machine via Ollama on port `11434` |
| **Zero Data Sharing** | Your email contents are **never** sent to OpenAI, Anthropic, or any third-party external APIs |
| **Secure Credentials** | Credentials and tokens are stored securely outside the repo in `~/.inbox-intel/` |
| **Local DB** | All processed data remains in a local SQLite file |
| **Read-Only Scope** | Gmail access is restricted to `gmail.readonly` — we cannot modify your emails |

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Python 3.11+** | Core runtime |
| **FastAPI** | REST API server |
| **LangGraph** | LLM pipeline orchestration |
| **Ollama** | Local LLM inference |
| **SQLite** | Local data persistence |
| **Pandas** | Data aggregation |
| **Loguru** | Structured logging |
| **Rich** | Beautiful CLI output |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool |
| **Tailwind CSS** | Styling |
| **Recharts** | Data visualization |
| **Lucide React** | Icons |
| **Streamlit** | Legacy dashboard |

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas We Need Help With
- [ ] Cross-platform startup scripts (Linux/Windows)
- [ ] Unit tests for `pipeline/nodes.py`
- [ ] Docker containerization
- [ ] Support for Outlook/IMAP email providers
- [ ] Mobile-responsive React dashboard

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [LangGraph](https://github.com/langchain-ai/langgraph) for the powerful state graph framework
- [Ollama](https://ollama.com/) for making local LLMs accessible
- [FastAPI](https://fastapi.tiangolo.com/) for the blazing-fast API framework
- [Recharts](https://recharts.org/) for beautiful React charts

---

<div align="center">

**Made with ❤️ by [sagar-69](https://github.com/sagar-69)**

*Star ⭐ this repo if you find it useful!*

</div>
