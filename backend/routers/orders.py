# =============================================================
# backend/routers/orders.py — POST /api/order
# =============================================================

from __future__ import annotations
import json
import logging
import secrets
import time

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_db
from backend.models import CartItem, OrderRequest, OrderResponse, OrderedItem
from backend.services.email_service import send_order_confirmation
from backend.services.razorpay_service import create_razorpay_order

log = logging.getLogger(__name__)
router = APIRouter()

# ── Default Fallback Product catalogue ──────────────────────────

PRODUCTS: dict[str, dict] = {
    "chocolate":          {"name": "Organic Chocolate",   "price": 899, "in_stock": True},
    "unflavored":         {"name": "Pure Unflavored",     "price": 749, "in_stock": True},
    "cheese-berry":       {"name": "Cheese Berry",        "price": 999, "in_stock": True},
    "honey-black-pepper": {"name": "Honey Black Pepper",  "price": 949, "in_stock": True},
}


async def get_live_products(db: aiosqlite.Connection) -> dict[str, dict]:
    """Fetches live prices & in-stock status from DB, falls back to defaults."""
    products = {}
    try:
        async with db.execute("SELECT id, name, price, in_stock, image FROM products") as cur:
            async for row in cur:
                products[row[0]] = {
                    "name": row[1],
                    "price": row[2],
                    "in_stock": bool(row[3]),
                    "image": row[4] or "",
                }
    except Exception:
        pass
    return products if products else PRODUCTS


@router.get("/api/products")
async def list_public_products(db: aiosqlite.Connection = Depends(get_db)):
    """Public endpoint returning live product prices & availability."""
    products = await get_live_products(db)
    return {"products": products}


def _generate_order_id() -> str:
    ts   = hex(int(time.time()))[2:].upper()
    rand = secrets.token_hex(3).upper()
    return f"HK-{ts}-{rand}"


@router.post("/api/order", response_model=OrderResponse, status_code=201)
async def place_order(
    body: OrderRequest,
    db:   aiosqlite.Connection = Depends(get_db),
) -> OrderResponse:
    """
    Place a new order.

    - Validates every product ID server-side against DB prices
    - Recomputes prices dynamically (never trusts client-sent amounts)
    - Applies free-shipping rule (3+ pouches)
    - Creates Razorpay payment order if keys are configured
    - Sends HTML order confirmation email if SMTP is configured
    - Persists to SQLite
    """
    live_products = await get_live_products(db)

    # ── Validate & resolve items ──────────────────────────────
    resolved: list[OrderedItem] = []
    for item in body.items:
        product = live_products.get(item.id)
        if not product:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown product: '{item.id}'. "
                       f"Valid products are: {', '.join(live_products)}",
            )
        if not product.get("in_stock", True):
            raise HTTPException(
                status_code=400,
                detail=f"Product '{product['name']}' is currently out of stock.",
            )
        resolved.append(OrderedItem(
            id=item.id,
            name=product["name"],
            price=product["price"],
            qty=item.qty,
            line_total=product["price"] * item.qty,
        ))

    # ── Compute totals ────────────────────────────────────────
    subtotal    = sum(i.line_total for i in resolved)
    total_qty   = sum(i.qty for i in resolved)
    shipping    = 0 if total_qty >= 3 else 79
    grand_total = subtotal + shipping

    order_id = _generate_order_id()

    # ── Razorpay (optional) ────────────────────────────────────
    razorpay_order_id = create_razorpay_order(grand_total, order_id)

    # ── Persist ───────────────────────────────────────────────
    await db.execute(
        """
        INSERT INTO orders (
            order_id, customer_name, customer_phone, customer_email,
            customer_address, items_json, subtotal, shipping,
            grand_total, razorpay_order_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
        """,
        (
            order_id,
            body.customer.name,
            body.customer.phone,
            body.customer.email,
            body.customer.address,
            json.dumps([i.model_dump() for i in resolved]),
            subtotal,
            shipping,
            grand_total,
            razorpay_order_id,
        ),
    )
    await db.commit()
    log.info("Order %s placed — ₹%s (shipping: ₹%s)", order_id, grand_total, shipping)

    # ── Email confirmation (non-blocking) ─────────────────────
    if body.customer.email:
        import asyncio
        asyncio.create_task(send_order_confirmation(
            to_email=body.customer.email,
            customer_name=body.customer.name,
            order_id=order_id,
            items=[i.model_dump() for i in resolved],
            subtotal=subtotal,
            shipping=shipping,
            grand_total=grand_total,
        ))

    return OrderResponse(
        success=True,
        order_id=order_id,
        subtotal=subtotal,
        shipping=shipping,
        grand_total=grand_total,
        razorpay_order_id=razorpay_order_id,
        message=f"Order {order_id} placed! We'll confirm dispatch within 24 hours.",
    )
