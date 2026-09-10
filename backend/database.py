# =============================================================
# backend/database.py — async SQLite setup via aiosqlite
# =============================================================

import aiosqlite
from pathlib import Path
from backend.config import get_settings


async def get_db() -> aiosqlite.Connection:
    """FastAPI dependency — yields an open DB connection per request."""
    settings = get_settings()
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        # WAL mode: safe concurrent reads, fast writes
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute("PRAGMA cache_size=-32000")
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


async def init_db() -> None:
    """Create tables on startup if they don't exist."""
    settings = get_settings()
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute("PRAGMA journal_mode=WAL")

        await db.executescript("""
            CREATE TABLE IF NOT EXISTS orders (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id         TEXT    NOT NULL UNIQUE,
                customer_name    TEXT    NOT NULL,
                customer_phone   TEXT    NOT NULL,
                customer_email   TEXT,
                customer_address TEXT,
                items_json       TEXT    NOT NULL,
                subtotal         INTEGER NOT NULL,
                shipping         INTEGER NOT NULL,
                grand_total      INTEGER NOT NULL,
                razorpay_order_id TEXT,
                status           TEXT    NOT NULL DEFAULT 'pending',
                created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                email      TEXT NOT NULL,
                subject    TEXT NOT NULL DEFAULT 'General Enquiry',
                message    TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_orders_order_id
                ON orders(order_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status
                ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_contacts_email
                ON contacts(email);
        """)
        await db.commit()
