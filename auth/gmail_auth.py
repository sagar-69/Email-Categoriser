"""
Gmail OAuth2 authentication helper — Multi-account support.

Supports multiple Google accounts by storing per-user tokens in
~/.inbox-intel/tokens/{email}.json

Profile metadata (name, photo) stored separately in
~/.inbox-intel/tokens/{email}_meta.json

Security: When TOKEN_ENCRYPTION_KEY is set in .env, tokens are
encrypted at rest using Fernet symmetric encryption.

Usage:
    from auth.gmail_auth import get_gmail_service
    service = get_gmail_service("user@gmail.com")
"""

import os
import json
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from loguru import logger
import requests as http_requests

from config.settings import GMAIL_SCOPES, CREDENTIALS_PATH

# ── Token encryption (optional) ──────────────────────────────────────────────
_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY", "").strip()
_fernet = None

if _ENCRYPTION_KEY:
    try:
        from cryptography.fernet import Fernet
        _fernet = Fernet(_ENCRYPTION_KEY.encode() if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY)
        logger.info("Token encryption enabled (Fernet).")
    except ImportError:
        logger.warning(
            "TOKEN_ENCRYPTION_KEY is set but 'cryptography' package is not installed. "
            "Tokens will be stored in plain text. Install with: pip install cryptography"
        )
    except Exception as exc:
        logger.warning("Invalid TOKEN_ENCRYPTION_KEY: {}. Tokens will be stored in plain text.", exc)


def _save_token_file(path: Path, data: str) -> None:
    """Save token data to file, encrypting if a key is configured."""
    if _fernet:
        encrypted = _fernet.encrypt(data.encode())
        path.write_bytes(encrypted)
    else:
        path.write_text(data)


def _load_token_file(path: Path) -> str:
    """Load token data from file, decrypting if a key is configured."""
    if _fernet:
        try:
            encrypted = path.read_bytes()
            return _fernet.decrypt(encrypted).decode()
        except Exception:
            # Fallback: try reading as plain text (migration from unencrypted)
            logger.debug("Could not decrypt {}, trying plain text.", path)
            return path.read_text()
    return path.read_text()

# ── Paths ────────────────────────────────────────────────────────────────────
TOKENS_DIR = Path(os.getenv("TOKENS_DIR", "~/.inbox-intel/tokens")).expanduser()
TOKENS_DIR.mkdir(parents=True, exist_ok=True)

# Legacy single-token path (for backward compatibility)
LEGACY_TOKEN_PATH = Path(os.getenv("TOKEN_PATH", "~/.inbox-intel/token.json")).expanduser()

# OAuth redirect URI — must match what's configured in Google Cloud Console
OAUTH_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")


def _token_path_for(email: str) -> Path:
    """Return the token file path for a given email address."""
    safe_name = email.replace("@", "_at_").replace(".", "_")
    return TOKENS_DIR / f"{safe_name}.json"


def _meta_path_for(email: str) -> Path:
    """Return the metadata file path for a given email address."""
    safe_name = email.replace("@", "_at_").replace(".", "_")
    return TOKENS_DIR / f"{safe_name}_meta.json"


def _fetch_user_info(creds: Credentials) -> dict:
    """Fetch user profile info (name, picture) from Google's userinfo endpoint."""
    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "name": data.get("name", ""),
                "picture": data.get("picture", ""),
                "email": data.get("email", ""),
            }
    except Exception as exc:
        logger.warning("Could not fetch user info: {}", exc)
    return {"name": "", "picture": "", "email": ""}


def _save_meta(email: str, meta: dict) -> None:
    """Save profile metadata for an account."""
    meta_path = _meta_path_for(email)
    meta_path.write_text(json.dumps(meta, indent=2))
    logger.debug("Saved metadata for {} at {}", email, meta_path)


def _load_meta(email: str) -> dict:
    """Load profile metadata for an account."""
    meta_path = _meta_path_for(email)
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text())
        except Exception:
            pass
    return {"name": "", "picture": "", "email": email}


def _migrate_legacy_token() -> None:
    """
    If a legacy single token.json exists and the tokens dir is empty,
    migrate it by reading the email from the token and moving it.
    """
    if not LEGACY_TOKEN_PATH.exists():
        return
    # Check if we already have tokens in the new directory
    existing = [f for f in TOKENS_DIR.glob("*.json") if not f.stem.endswith("_meta")]
    if existing:
        return
    try:
        creds = Credentials.from_authorized_user_file(str(LEGACY_TOKEN_PATH), GMAIL_SCOPES)
        if creds and creds.valid or (creds and creds.expired and creds.refresh_token):
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
            # Get the email from the Gmail API
            service = build("gmail", "v1", credentials=creds)
            profile = service.users().getProfile(userId="me").execute()
            email = profile.get("emailAddress", "unknown")
            dest = _token_path_for(email)
            _save_token_file(dest, creds.to_json())
            # Fetch and save profile metadata
            user_info = _fetch_user_info(creds)
            _save_meta(email, user_info)
            logger.info("Migrated legacy token to {} for account {}", dest, email)
    except Exception as exc:
        logger.warning("Could not migrate legacy token: {}", exc)


# Run migration on module load
_migrate_legacy_token()


def get_auth_url() -> str:
    """
    Generate and return the Google OAuth2 consent screen URL.
    The user should be redirected to this URL to authorize.
    """
    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            f"credentials.json not found at {CREDENTIALS_PATH}. "
            "Download it from Google Cloud Console → APIs & Services → Credentials."
        )
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_PATH),
        scopes=GMAIL_SCOPES + [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
        redirect_uri=OAUTH_REDIRECT_URI,
    )
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return auth_url


def handle_auth_callback(code: str) -> dict:
    """
    Exchange the authorization code for credentials.
    Fetches the user's email + profile info, saves the token, and returns account info.

    Returns: { "email": str, "name": str, "picture": str }
    """
    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            f"credentials.json not found at {CREDENTIALS_PATH}."
        )
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_PATH),
        scopes=GMAIL_SCOPES + [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
        redirect_uri=OAUTH_REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Get the user's email address
    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    email = profile.get("emailAddress", "unknown")

    # Save the token
    token_path = _token_path_for(email)
    _save_token_file(token_path, creds.to_json())
    logger.info("Saved token for {} at {}", email, token_path)

    # Fetch and save profile metadata (name, picture)
    user_info = _fetch_user_info(creds)
    user_info["email"] = email
    _save_meta(email, user_info)

    return user_info


def get_credentials(owner_email: str | None = None) -> Credentials:
    """
    Return valid Google OAuth2 credentials for the specified account.
    If owner_email is None, uses the first available token.
    """
    if owner_email:
        token_path = _token_path_for(owner_email)
    else:
        # Fallback: use first available token, or legacy token
        tokens = [f for f in TOKENS_DIR.glob("*.json") if not f.stem.endswith("_meta")]
        if tokens:
            token_path = tokens[0]
        elif LEGACY_TOKEN_PATH.exists():
            token_path = LEGACY_TOKEN_PATH
        else:
            raise FileNotFoundError(
                "No authenticated accounts found. "
                "Please log in via the dashboard first."
            )

    if not token_path.exists():
        raise FileNotFoundError(
            f"No token found for {owner_email}. "
            "Please log in via the dashboard first."
        )

    token_data = _load_token_file(token_path)
    creds = Credentials.from_authorized_user_info(json.loads(token_data), GMAIL_SCOPES)
    logger.debug("Loaded token from {}", token_path)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired token for {}...", owner_email or "default")
            try:
                from google.auth.exceptions import RefreshError
                creds.refresh(Request())
            except RefreshError as exc:
                logger.error("Token refresh failed for {}: {}", owner_email or "default", exc)
                raise RuntimeError(
                    f"Token for {owner_email or 'default'} could not be refreshed (it may have been revoked or changed scopes). "
                    "Please re-authenticate via the dashboard."
                )
            _save_token_file(token_path, creds.to_json())
            logger.info("Token refreshed and saved to {}", token_path)
        else:
            raise RuntimeError(
                f"Token for {owner_email or 'default'} is invalid and cannot be refreshed. "
                "Please re-authenticate via the dashboard."
            )

    # ── Scope-mismatch detection ─────────────────────────────────────────
    # Tokens issued before the gmail.compose scope was added will be
    # missing it. Detect this so callers get a clear error.
    if creds.scopes:
        missing = set(GMAIL_SCOPES) - set(creds.scopes)
        if missing:
            logger.warning(
                "Token for {} is missing scopes: {}. Re-authentication required.",
                owner_email or "default", missing,
            )

    return creds


def get_gmail_service(owner_email: str | None = None):
    """Return an authenticated Gmail API service object for the specified account."""
    creds = get_credentials(owner_email)
    service = build("gmail", "v1", credentials=creds)
    logger.info("Gmail service initialised for {}.", owner_email or "default")
    return service


def list_authenticated_accounts() -> list[dict]:
    """
    Return a list of authenticated account info dicts.
    Each dict: { "email": str, "name": str, "picture": str }
    """
    accounts = []
    token_files = sorted(
        f for f in TOKENS_DIR.glob("*.json") if not f.stem.endswith("_meta")
    )
    for token_file in token_files:
        try:
            # Extract email from filename
            name = token_file.stem  # e.g. "user_at_gmail_com"
            email = name.replace("_at_", "@").replace("_", ".", 1)
            parts = email.split("@")
            if len(parts) == 2:
                email = parts[0] + "@" + parts[1].replace("_", ".")

            # Load metadata
            meta = _load_meta(email)
            accounts.append({
                "email": email,
                "name": meta.get("name", ""),
                "picture": meta.get("picture", ""),
            })
        except Exception:
            continue
    return accounts


def remove_account(email: str) -> bool:
    """Remove a saved OAuth token and metadata for the given email. Returns True if removed."""
    token_path = _token_path_for(email)
    meta_path = _meta_path_for(email)
    removed = False
    if token_path.exists():
        token_path.unlink()
        removed = True
    if meta_path.exists():
        meta_path.unlink()
    if removed:
        logger.info("Removed token and metadata for {}", email)
    return removed
