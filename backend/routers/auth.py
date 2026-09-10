# =============================================================
# backend/routers/auth.py — Customer Registration & Authentication
# =============================================================

from __future__ import annotations
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

import aiosqlite
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status

from backend.config import get_settings
from backend.database import get_db
from backend.models import (
    UserAuthResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Password Hashing Helpers ─────────────────────────────────

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{base64.b64encode(salt).decode('ascii')}${base64.b64encode(key).decode('ascii')}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_b64, key_b64 = stored_hash.split("$", 1)
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_key = base64.b64decode(key_b64.encode("ascii"))
        computed_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(expected_key, computed_key)
    except Exception:
        return False


# ── JWT Helpers ──────────────────────────────────────────────

def create_user_token(user_id: int, email: str, name: str) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "role": "customer",
        "iat": now,
        "exp": now + (86400 * 30),  # 30 days
    }
    raw_payload = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_payload).rstrip(b"=").decode("ascii")

    sig = hmac.new(
        key=settings.admin_secret_key.encode("utf-8"),
        msg=payload_b64.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")

    return f"{payload_b64}.{sig_b64}"


def verify_user_token(token: str) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    settings = get_settings()
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding

        sig_padding = 4 - len(sig_b64) % 4
        if sig_padding != 4:
            sig_b64 += "=" * sig_padding

        expected_sig = hmac.new(
            key=settings.admin_secret_key.encode("utf-8"),
            msg=payload_b64.rstrip("=").encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        provided_sig = base64.urlsafe_b64decode(sig_b64.encode("ascii"))

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        raw_payload = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
        payload = json.loads(raw_payload.decode("utf-8"))

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if not token:
        token = request.cookies.get("husk_customer_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Customer authentication required",
        )

    payload = verify_user_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token",
        )

    user_id = int(payload.get("sub", 0))
    async with db.execute(
        "SELECT id, name, email, phone, address, city, pincode, created_at FROM users WHERE id = ?",
        (user_id,),
    ) as cur:
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "phone": row[3],
            "address": row[4],
            "city": row[5],
            "pincode": row[6],
            "created_at": row[7],
        }


# ── Customer Registration ─────────────────────────────────────

@router.post("/register", response_model=UserAuthResponse)
async def register_user(
    body: UserRegisterRequest,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Registers a new customer, hashes password securely, saves full contact & address
    profile in SQLite, and returns a 30-day session token.
    """
    email_clean = body.email.strip().lower()

    # Check for existing email
    async with db.execute("SELECT id FROM users WHERE lower(email) = ?", (email_clean,)) as cur:
        if await cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please login.",
            )

    pwd_hash = hash_password(body.password)

    async with db.execute(
        """
        INSERT INTO users (name, email, phone, password_hash, address, city, pincode, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """,
        (
            body.name.strip(),
            email_clean,
            body.phone,
            pwd_hash,
            body.address,
            body.city,
            body.pincode,
        ),
    ) as cur:
        user_id = cur.lastrowid

    await db.commit()

    token = create_user_token(user_id, email_clean, body.name.strip())
    settings = get_settings()

    response.set_cookie(
        key="husk_customer_token",
        value=token,
        max_age=86400 * 30,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path="/",
    )

    user_profile = UserProfileResponse(
        id=user_id,
        name=body.name.strip(),
        email=email_clean,
        phone=body.phone,
        address=body.address,
        city=body.city,
        pincode=body.pincode,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
    )

    return UserAuthResponse(
        success=True,
        token=token,
        user=user_profile,
        message="Account created successfully! Welcome to Husk & Co.",
    )


# ── Customer Login ───────────────────────────────────────────

@router.post("/login", response_model=UserAuthResponse)
async def login_user(
    body: UserLoginRequest,
    response: Response,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Authenticates customer by email (or phone), verifies hash, updates last_login,
    and returns session token.
    """
    identifier = body.email.strip().lower()

    async with db.execute(
        """
        SELECT id, name, email, phone, password_hash, address, city, pincode, created_at
        FROM users
        WHERE lower(email) = ? OR phone = ?
        """,
        (identifier, identifier),
    ) as cur:
        row = await cur.fetchone()

    if not row or not verify_password(body.password, row[4]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again.",
        )

    user_id = row[0]
    name = row[1]
    email = row[2]

    # Update last login
    await db.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user_id,))
    await db.commit()

    token = create_user_token(user_id, email, name)
    settings = get_settings()

    max_age = 86400 * 30 if body.remember_me else 86400
    response.set_cookie(
        key="husk_customer_token",
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path="/",
    )

    user_profile = UserProfileResponse(
        id=user_id,
        name=name,
        email=email,
        phone=row[3],
        address=row[5],
        city=row[6],
        pincode=row[7],
        created_at=row[8] or "",
    )

    return UserAuthResponse(
        success=True,
        token=token,
        user=user_profile,
        message=f"Welcome back, {name}!",
    )


# ── Current Customer Profile ──────────────────────────────────

@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated customer profile."""
    return UserProfileResponse(**current_user)


# ── Customer Logout ───────────────────────────────────────────

@router.post("/logout")
async def logout_user(response: Response):
    """Clears customer auth cookies."""
    response.delete_cookie(key="husk_customer_token", path="/")
    return {"success": True, "message": "Signed out successfully"}
