# =============================================================
# backend/routers/ai.py — All AI/Gemini-powered API endpoints
# =============================================================

from __future__ import annotations

import logging
from typing import Any

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.config import get_settings
from backend.database import get_db
from backend.limiter import limiter
from backend.services.gemini_service import (
    answer_health_faq,
    answer_order_query,
    chat_with_ai,
    generate_admin_content,
    generate_product_description,
    get_product_recommendations,
    semantic_search,
    summarize_reviews,
)

log = logging.getLogger("husk-co")
router = APIRouter(prefix="/api/ai", tags=["ai"])


# ── Request / Response Models ─────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "model"
    parts: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=40)


class RecommendRequest(BaseModel):
    goal: str = Field(min_length=2, max_length=300)
    preferences: str = Field(default="", max_length=300)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)


class ReviewSummaryRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=40)
    reviews: list[str] = Field(min_length=1, max_length=100)


class ProductDescRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=40)
    tone: str = Field(default="premium")        # premium | friendly | scientific
    length: str = Field(default="short")        # short | medium | long


class OrderQueryRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    order_id: str | None = Field(default=None, max_length=30)


class HealthFAQRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class ContentGenRequest(BaseModel):
    content_type: str = Field(default="blog")  # blog | email | social | whatsapp | ad_copy
    topic: str = Field(min_length=3, max_length=300)
    tone: str = Field(default="professional")  # professional | friendly | scientific | luxury


# ── Helpers ───────────────────────────────────────────────────

def _require_ai():
    if not get_settings().gemini_enabled:
        raise HTTPException(status_code=503, detail="AI features are not configured. Add GEMINI_API_KEY to .env")


# ── 1. AI Chatbot ─────────────────────────────────────────────

@router.post("/chat")
@limiter.limit("30/minute")
async def ai_chat(request: Request, body: ChatRequest):
    """
    Multi-turn AI chatbot for customer support.
    Handles product queries, usage questions, wellness advice.
    """
    _require_ai()
    history = [{"role": m.role, "parts": m.parts} for m in body.history]
    reply = await chat_with_ai(body.message, history)
    return {"reply": reply}


# ── 2. Product Recommendations ────────────────────────────────

@router.post("/recommend")
@limiter.limit("20/minute")
async def recommend_products(request: Request, body: RecommendRequest):
    """
    AI-powered product recommendations based on customer health goals.
    Returns ranked product IDs with reasoning.
    """
    _require_ai()
    result = await get_product_recommendations(body.goal, body.preferences)
    return result


# ── 3. AI Semantic Search ─────────────────────────────────────

@router.post("/search")
@limiter.limit("30/minute")
async def ai_search(request: Request, body: SearchRequest):
    """
    Natural language product search.
    Query: 'good for digestion', 'something for morning', etc.
    """
    _require_ai()
    results = await semantic_search(body.query)
    return {"results": results, "query": body.query}


# ── 4. Review Summarizer (Admin) ──────────────────────────────

@router.post("/admin/summarize-reviews")
@limiter.limit("10/minute")
async def summarize_product_reviews(request: Request, body: ReviewSummaryRequest):
    """Admin endpoint: summarize customer reviews for a product using AI."""
    _require_ai()
    result = await summarize_reviews(body.product_id, body.reviews)
    return result


# ── 5. Product Description Generator (Admin) ─────────────────

@router.post("/admin/generate-description")
@limiter.limit("15/minute")
async def ai_generate_description(request: Request, body: ProductDescRequest):
    """Admin endpoint: AI-generated product marketing copy."""
    _require_ai()
    result = await generate_product_description(body.product_id, body.tone, body.length)
    return result


# ── 6. Order Query Bot ────────────────────────────────────────

@router.post("/order-query")
@limiter.limit("20/minute")
async def order_query_bot(
    request: Request,
    body: OrderQueryRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    AI-powered order status assistant.
    Fetches real order data from DB if order_id provided.
    """
    _require_ai()
    order_data = None
    if body.order_id:
        try:
            async with db.execute(
                """SELECT order_id, customer_name, status, items_json,
                          grand_total, created_at
                   FROM orders WHERE order_id = ?""",
                (body.order_id.upper(),),
            ) as cur:
                row = await cur.fetchone()
                if row:
                    order_data = {
                        "order_id": row[0],
                        "customer_name": row[1],
                        "status": row[2],
                        "items": row[3],
                        "grand_total": row[4],
                        "created_at": row[5],
                    }
        except Exception as e:
            log.warning("Order lookup error: %s", e)

    reply = await answer_order_query(body.message, order_data)
    return {
        "reply": reply,
        "order_found": order_data is not None,
        "order_status": order_data.get("status") if order_data else None,
    }


# ── 7. Health FAQ Assistant ───────────────────────────────────

@router.post("/health-faq")
@limiter.limit("30/minute")
async def health_faq(request: Request, body: HealthFAQRequest):
    """
    AI-powered health & wellness FAQ assistant.
    Answers psyllium husk health questions with science-backed info.
    """
    _require_ai()
    result = await answer_health_faq(body.question)
    return result


# ── 8. Admin Content Generator ────────────────────────────────

@router.post("/admin/generate-content")
@limiter.limit("10/minute")
async def ai_generate_content(request: Request, body: ContentGenRequest):
    """
    Admin content generation: blog posts, emails, social media, WhatsApp, ad copy.
    """
    _require_ai()
    result = await generate_admin_content(body.content_type, body.topic, body.tone)
    return result


# ── AI Status Check ───────────────────────────────────────────

@router.get("/status")
async def ai_status():
    """Check if AI features are available."""
    settings = get_settings()
    return {
        "enabled": settings.gemini_enabled,
        "features": [
            "chatbot",
            "recommendations",
            "search",
            "review_summarizer",
            "description_generator",
            "order_query_bot",
            "health_faq",
            "content_generator",
        ] if settings.gemini_enabled else [],
    }
