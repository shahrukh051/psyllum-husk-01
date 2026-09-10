# =============================================================
# backend/services/auth_service.py — HMAC token auth for Admin
# =============================================================

from __future__ import annotations
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

import aiosqlite
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from backend.config import get_settings


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_admin_token(username: str, expires_in_seconds: int = 86400 * 7) -> str:
    """Creates an HMAC-SHA256 signed admin session token."""
    settings = get_settings()
    payload = {
        "sub": username,
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in_seconds,
    }
    raw_payload = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64_encode(raw_payload)

    signature = hmac.new(
        key=settings.admin_secret_key.encode("utf-8"),
        msg=payload_b64.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    sig_b64 = _b64_encode(signature)

    return f"{payload_b64}.{sig_b64}"


def verify_admin_token(token: str) -> dict[str, Any] | None:
    """Verifies HMAC signature and expiration. Returns payload dict or None."""
    if not token or "." not in token:
        return None

    settings = get_settings()
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(
            key=settings.admin_secret_key.encode("utf-8"),
            msg=payload_b64.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()

        provided_sig = _b64_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        raw_payload = _b64_decode(payload_b64)
        payload = json.loads(raw_payload.decode("utf-8"))

        if payload.get("exp", 0) < time.time():
            return None

        if payload.get("role") != "admin":
            return None

        return payload
    except Exception:
        return None


async def get_admin_credentials(db: aiosqlite.Connection) -> tuple[str, str]:
    """Retrieves current admin username & password from DB or config fallback."""
    settings = get_settings()
    username = settings.admin_username
    password = settings.admin_password

    try:
        async with db.execute("SELECT value FROM admin_config WHERE key = 'admin_username'") as cur:
            row = await cur.fetchone()
            if row and row[0]:
                username = row[0]

        async with db.execute("SELECT value FROM admin_config WHERE key = 'admin_password'") as cur:
            row = await cur.fetchone()
            if row and row[0]:
                password = row[0]
    except Exception:
        pass

    return username, password


async def verify_admin_credentials(username: str, password: str, db: aiosqlite.Connection) -> bool:
    """Timing-safe verification of admin credentials against DB & config."""
    expected_user, expected_pass = await get_admin_credentials(db)
    user_ok = hmac.compare_digest(username.strip().lower(), expected_user.strip().lower())
    pass_ok = hmac.compare_digest(password.strip(), expected_pass.strip())
    return user_ok and pass_ok


async def verify_admin_password_only(password: str, db: aiosqlite.Connection) -> bool:
    """Timing-safe verification of admin current password against DB (or config fallback)."""
    _, expected_pass = await get_admin_credentials(db)
    return hmac.compare_digest((password or "").strip(), (expected_pass or "").strip())


async def update_admin_password(new_password: str, db: aiosqlite.Connection) -> bool:
    """Updates the admin password in the database admin_config table and clears settings cache."""
    await db.execute(
        "INSERT INTO admin_config (key, value) VALUES ('admin_password', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (new_password.strip(),),
    )
    await db.execute(
        "INSERT INTO admin_config (key, value) VALUES ('admin_username', 'shahrukh') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    await db.commit()
    get_settings.cache_clear()
    return True


async def get_current_admin(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    FastAPI dependency that validates admin authentication via:
    1. Authorization: Bearer <token>
    2. Cookie: husk_admin_token
    """
    token: str | None = None

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    if not token:
        token = request.cookies.get("husk_admin_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_admin_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload
