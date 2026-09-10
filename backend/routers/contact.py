# =============================================================
# backend/routers/contact.py — POST /api/contact
# =============================================================

from __future__ import annotations
import asyncio
import logging

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_db
from backend.models import ContactRequest, ContactResponse
from backend.services.email_service import send_contact_acknowledgement

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/contact", response_model=ContactResponse, status_code=201)
async def submit_contact(
    body: ContactRequest,
    db:   aiosqlite.Connection = Depends(get_db),
) -> ContactResponse:
    """
    Submit a contact/newsletter form.

    - Deduplicates: same email + message within 5 minutes → 429
    - Persists to SQLite contacts table
    - Sends HTML acknowledgement email (non-blocking)
    """
    # ── Duplicate guard ───────────────────────────────────────
    async with db.execute(
        """
        SELECT id FROM contacts
        WHERE email = ? AND message = ?
          AND created_at > datetime('now', '-5 minutes')
        LIMIT 1
        """,
        (body.email, body.message or ""),
    ) as cursor:
        if await cursor.fetchone():
            raise HTTPException(
                status_code=429,
                detail="Duplicate submission — please wait a few minutes before trying again.",
            )

    # ── Persist ───────────────────────────────────────────────
    await db.execute(
        """
        INSERT INTO contacts (name, email, subject, message, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        """,
        (body.name, body.email, body.subject, body.message or ""),
    )
    await db.commit()
    log.info("Contact from %s — %s", body.email, body.subject)

    # ── Email ack (non-blocking) ──────────────────────────────
    asyncio.create_task(send_contact_acknowledgement(
        to_email=body.email,
        name=body.name,
        message=body.message or "",
    ))

    return ContactResponse(
        success=True,
        message="Thanks for reaching out! We'll get back to you within 24 hours.",
    )
