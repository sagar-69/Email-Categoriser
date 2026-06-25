"""
JWT authentication utilities for FastAPI.

Provides token creation and a FastAPI dependency for protecting routes.
Uses a pure-Python implementation (hmac + base64) to avoid external dependencies.
Compatible with standard JWT format (HS256).
"""

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.settings import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES

# Security scheme — shows the lock icon in Swagger/OpenAPI docs
_bearer_scheme = HTTPBearer(auto_error=False)


def _base64url_encode(data: bytes) -> str:
    """Base64url encode without padding (JWT standard)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(s: str) -> bytes:
    """Base64url decode with padding restoration."""
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_jwt_token(email: str, expires_minutes: int | None = None) -> str:
    """
    Create a signed JWT token for the given email address.

    Args:
        email: The authenticated user's email address.
        expires_minutes: Override the default token expiry (in minutes).

    Returns:
        Encoded JWT string.
    """
    expiry = expires_minutes or JWT_EXPIRY_MINUTES
    now = int(time.time())

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": email,
        "iat": now,
        "exp": now + (expiry * 60),
    }

    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode())

    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        JWT_SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    sig_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_jwt_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Returns:
        The decoded payload dict.

    Raises:
        HTTPException 401 if the token is invalid or expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Token must have 3 parts")

        header_b64, payload_b64, sig_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            JWT_SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _base64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Signature verification failed")

        # Decode payload
        payload = json.loads(_base64url_decode(payload_b64))

        # Check expiration
        exp = payload.get("exp", 0)
        if time.time() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header.

    Returns:
        The authenticated user's email address.

    Raises:
        HTTPException 401 if no token is provided or the token is invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_jwt_token(credentials.credentials)
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing 'sub' claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[str]:
    """
    Like get_current_user but returns None instead of raising 401
    when no token is provided. Useful for endpoints that work with
    or without authentication.
    """
    if credentials is None:
        return None
    try:
        payload = verify_jwt_token(credentials.credentials)
        return payload.get("sub")
    except HTTPException:
        return None
