"""
Gmail OAuth2 authentication helper.

Usage:
    from auth.gmail_auth import get_gmail_service
    service = get_gmail_service()
"""

import os
import json
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from loguru import logger

from config.settings import GMAIL_SCOPES, TOKEN_PATH, CREDENTIALS_PATH


def get_credentials() -> Credentials:
    """
    Return valid Google OAuth2 credentials.
    - If token.json exists and is valid: return it directly.
    - If expired and refreshable: refresh and save.
    - If missing or unrefreshable: run browser OAuth flow.
    """
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), GMAIL_SCOPES)
        logger.debug("Loaded existing token from {}", TOKEN_PATH)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired token...")
            creds.refresh(Request())
        else:
            logger.info("Launching OAuth browser flow...")
            if not CREDENTIALS_PATH.exists():
                raise FileNotFoundError(
                    f"credentials.json not found at {CREDENTIALS_PATH}. "
                    "Download it from Google Cloud Console → APIs & Services → Credentials."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_PATH), GMAIL_SCOPES
            )
            creds = flow.run_local_server(port=8080)

        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_PATH.write_text(creds.to_json())
        logger.info("Token saved to {}", TOKEN_PATH)

    return creds


def get_gmail_service():
    """Return an authenticated Gmail API service object."""
    creds = get_credentials()
    service = build("gmail", "v1", credentials=creds)
    logger.info("Gmail service initialised.")
    return service
