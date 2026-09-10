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

            CREATE TABLE IF NOT EXISTS products (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                price      INTEGER NOT NULL,
                in_stock   INTEGER NOT NULL DEFAULT 1,
                image      TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS admin_config (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT UNIQUE NOT NULL,
                phone         TEXT,
                password_hash TEXT NOT NULL,
                address       TEXT,
                city          TEXT,
                pincode       TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                last_login    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_orders_order_id
                ON orders(order_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status
                ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_contacts_email
                ON contacts(email);
            CREATE INDEX IF NOT EXISTS idx_users_email
                ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_phone
                ON users(phone);
        """)

        # Insert default products if table is empty
        async with db.execute("SELECT count(*) FROM products") as cur:
            count = (await cur.fetchone())[0]
            if count == 0:
                await db.executemany(
                    """
                    INSERT INTO products (id, name, price, in_stock, image)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [
                        ("chocolate", "Organic Chocolate", 899, 1, "/images/packages/chocolate%20pack.png"),
                        ("unflavored", "Pure Unflavored", 749, 1, "/images/packages/unflavored%20pack.png"),
                        ("cheese-berry", "Cheese Berry", 999, 1, "/images/packages/%27cheese%20berry%20pack.png"),
                        ("honey-black-pepper", "Honey Black Pepper", 949, 1, "/images/packages/Honey%20paper%20black%20pack.png"),
                    ],
                )
        await db.commit()
