# =============================================================
# backend/services/razorpay_service.py
# Razorpay payment order creation
# Gracefully disabled when keys are not configured
# =============================================================

from __future__ import annotations
import logging
import razorpay

from backend.config import get_settings

log = logging.getLogger(__name__)


def create_razorpay_order(amount_inr: int, order_id: str) -> str | None:
    """
    Creates a Razorpay order and returns the Razorpay order ID.
    Returns None if Razorpay is not configured.

    Args:
        amount_inr: Total amount in Indian Rupees (integer)
        order_id:   Internal Husk & Co. order ID (used as receipt)

    Returns:
        Razorpay order ID (e.g. "order_xxxxxxxxxxxx") or None
    """
    settings = get_settings()

    if not settings.razorpay_enabled:
        log.info("Razorpay not configured — skipping payment order creation")
        return None

    try:
        client = razorpay.Client(
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret)
        )
        # Razorpay amounts are in paise (1 INR = 100 paise)
        rz_order = client.order.create({
            "amount":   amount_inr * 100,
            "currency": "INR",
            "receipt":  order_id,
            "notes": {
                "source": "husk-co-website",
                "order_id": order_id,
            },
        })
        log.info("Razorpay order created: %s for ₹%s", rz_order["id"], amount_inr)
        return rz_order["id"]

    except Exception as exc:
        log.error("Razorpay order creation failed: %s", exc)
        # Don't block the order — just proceed without payment order
        return None
