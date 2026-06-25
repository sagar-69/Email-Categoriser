import os
from pathlib import Path
from dotenv import load_dotenv
from enum import Enum

load_dotenv()

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
CRED_DIR = Path(os.getenv("TOKEN_PATH", "~/.inbox-intel/token.json")).expanduser().parent
DB_PATH  = Path(os.getenv("DB_PATH", "~/.inbox-intel/emails.db")).expanduser()
TOKEN_PATH = Path(os.getenv("TOKEN_PATH", "~/.inbox-intel/token.json")).expanduser()
CREDENTIALS_PATH = Path(os.getenv("CREDENTIALS_PATH", "~/.inbox-intel/credentials.json")).expanduser()

# ── Ollama ───────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT", "60"))

# ── Gmail ────────────────────────────────────────────────────────────────────
GMAIL_SCOPES      = ["https://www.googleapis.com/auth/gmail.readonly"]
MAX_EMAILS_PER_RUN = int(os.getenv("MAX_EMAILS_PER_RUN", "200"))

# ── Security ─────────────────────────────────────────────────────────────────
# Optional: set to a Fernet key to encrypt OAuth tokens at rest
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY", "")

# ── JWT Authentication ──────────────────────────────────────────────────────
import secrets
JWT_SECRET_KEY  = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "1440"))  # 24 hours

# ── SSL / HTTPS (optional) ──────────────────────────────────────────────────
SSL_KEYFILE  = os.getenv("SSL_KEYFILE", "")
SSL_CERTFILE = os.getenv("SSL_CERTFILE", "")

# ── Classification Enums ─────────────────────────────────────────────────────
class EmailTypeLabel(str, Enum):
    SALES      = "SALES"
    SUPPORT    = "SUPPORT"
    SPAM       = "SPAM"
    MARKETING  = "MARKETING"
    GENERAL    = "GENERAL"
    INTERNAL   = "INTERNAL"

class ActionLabel(str, Enum):
    ACTION_REQUIRED = "ACTION_REQUIRED"
    AWAITING_REPLY  = "AWAITING_REPLY"
    FYI             = "FYI"
    REFERENCE       = "REFERENCE"

class DepartmentLabel(str, Enum):
    HR_ADMIN          = "HR_ADMIN"
    INTERNAL_PROJECT  = "INTERNAL_PROJECT"
    EXTERNAL_CLIENT   = "EXTERNAL_CLIENT"
    IT_SYSTEMS        = "IT_SYSTEMS"
    FINANCE           = "FINANCE"

class PriorityLabel(str, Enum):
    URGENT       = "URGENT"
    STANDARD     = "STANDARD"
    LOW_PRIORITY = "LOW_PRIORITY"

# ── Display maps (label → human-readable) ────────────────────────────────────
EMAIL_TYPE_DISPLAY = {
    "SALES":     "Sales",
    "SUPPORT":   "Support",
    "SPAM":      "Spam",
    "MARKETING": "Marketing",
    "GENERAL":   "General",
    "INTERNAL":  "Internal",
}
ACTION_DISPLAY = {
    "ACTION_REQUIRED": "Action required",
    "AWAITING_REPLY":  "Awaiting reply",
    "FYI":             "FYI",
    "REFERENCE":       "Reference",
}
DEPT_DISPLAY = {
    "HR_ADMIN":         "HR & Admin",
    "INTERNAL_PROJECT": "Internal project",
    "EXTERNAL_CLIENT":  "External / Client",
    "IT_SYSTEMS":       "IT & Systems",
    "FINANCE":          "Finance",
}
PRIORITY_DISPLAY = {
    "URGENT":       "Urgent",
    "STANDARD":     "Standard",
    "LOW_PRIORITY": "Low priority",
}

# ── Tag colours for dashboard (Streamlit-compatible hex) ─────────────────────
EMAIL_TYPE_COLOURS = {
    "SALES":     "#2E86DE",
    "SUPPORT":   "#E55039",
    "SPAM":      "#888780",
    "MARKETING": "#F6B93B",
    "GENERAL":   "#1D9E75",
    "INTERNAL":  "#7F77DD",
}
ACTION_COLOURS = {
    "ACTION_REQUIRED": "#D85A30",
    "AWAITING_REPLY":  "#BA7517",
    "FYI":             "#378ADD",
    "REFERENCE":       "#639922",
}
DEPT_COLOURS = {
    "HR_ADMIN":         "#D4537E",
    "INTERNAL_PROJECT": "#378ADD",
    "EXTERNAL_CLIENT":  "#D85A30",
    "IT_SYSTEMS":       "#639922",
    "FINANCE":          "#7F77DD",
}
PRIORITY_COLOURS = {
    "URGENT":       "#E24B4A",
    "STANDARD":     "#888780",
    "LOW_PRIORITY": "#1D9E75",
}

CLASSIFICATION_RETRIES = int(os.getenv("CLASSIFICATION_RETRIES", "3"))
