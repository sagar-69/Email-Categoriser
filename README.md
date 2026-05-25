# inbox-intel

A local, privacy-first Gmail email categorisation dashboard powered by
LangGraph, Ollama, and Streamlit.

## Quick start

### Prerequisites
- Python 3.11+
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- A Google Cloud project with Gmail API enabled and OAuth credentials downloaded

### 1. Clone and install
```bash
git clone https://github.com/your-handle/inbox-intel
cd inbox-intel
bash scripts/setup.sh
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env with your Google OAuth client ID and secret
# Place credentials.json in ~/.inbox-intel/
```

### 3. Run
Activate the virtual environment first, then run the app:
```bash
source venv/bin/activate
python scripts/run.py
```

The first run opens a browser for Google OAuth consent.
After authorising, the pipeline classifies your unread emails and
launches the Streamlit dashboard at http://localhost:8501.

## Commands
| Command | Effect |
|---------|--------|
| `python scripts/run.py` | Classify + open dashboard |
| `python scripts/run.py --fetch-only` | Classify, no dashboard |
| `python scripts/run.py --dash-only` | Skip classify, open dashboard |
| `streamlit run dashboard/app.py` | Dashboard only |
| `pytest tests/` | Run unit tests |

## Architecture

```
Gmail API → LangGraph (parse → classify → store) → SQLite → Streamlit
                          ↕
                    Ollama (phi3:mini)
```

### Pipeline flow
1. **Fetch** — Pull unread emails from Gmail via OAuth
2. **Parse** — Format email into classification prompt
3. **Classify** — Send to Ollama, parse JSON response, validate labels
4. **Store** — Persist to SQLite
5. **Display** — Render in Streamlit dashboard

### Classification labels
| Group | Labels |
|-------|--------|
| Action intent | ACTION_REQUIRED, AWAITING_REPLY, FYI, REFERENCE |
| Department | HR_ADMIN, INTERNAL_PROJECT, EXTERNAL_CLIENT, IT_SYSTEMS, FINANCE |
| Priority | URGENT, STANDARD, LOW_PRIORITY |

## Project structure
```
inbox-intel/
├── config/settings.py          # Central config and enums
├── auth/gmail_auth.py          # OAuth2 flow
├── pipeline/
│   ├── state.py                # EmailState TypedDict
│   ├── nodes.py                # LangGraph node functions
│   ├── graph.py                # Graph assembly
│   └── prompts.py              # LLM prompt templates
├── data/
│   ├── fetcher.py              # Gmail API calls
│   ├── store.py                # SQLite helpers
│   └── schema.sql              # DB schema
├── dashboard/
│   ├── app.py                  # Streamlit entry point
│   ├── charts.py               # Plotly chart builders
│   └── styles.py               # Custom CSS
├── scripts/
│   ├── setup.sh                # Setup script
│   └── run.py                  # CLI runner
└── tests/
    ├── test_pipeline.py
    └── test_fetcher.py
```

## Privacy
- All LLM inference runs locally via Ollama (`localhost:11434`)
- No email content is sent to any external service
- Credentials are stored in `~/.inbox-intel/`, never in the repo
- The database is local SQLite

## License
MIT
