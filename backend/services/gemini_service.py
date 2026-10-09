# =============================================================
# backend/services/gemini_service.py — Gemini AI integration
# Uses the new google-genai SDK (google.genai)
# Provides: chatbot, recommendations, search, review summary,
#           product description, order query, health FAQ, content gen
# =============================================================

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from google import genai
from google.genai import types

from backend.config import get_settings

log = logging.getLogger("husk-co")

# ── Product knowledge base ─────────────────────────────────────

PRODUCT_CATALOG = {
    "chocolate": {
        "name": "Organic Chocolate",
        "price": 899,
        "flavor": "Rich cocoa",
        "badge": "Bestseller",
        "description": "Rich, ethically sourced cocoa meets daily digestive wellness.",
        "best_for": ["chocolate lovers", "morning routines", "smoothies", "energy"],
        "ingredients": ["psyllium husk", "organic cocoa", "natural chocolate flavour"],
    },
    "unflavored": {
        "name": "Pure Unflavored",
        "price": 749,
        "flavor": "Neutral",
        "badge": "Pure",
        "description": "The raw, foundational ingredient. Built for smoothies, baking, or straight in water.",
        "best_for": ["baking", "cooking", "smoothies", "no added flavour", "budget-friendly"],
        "ingredients": ["psyllium husk"],
    },
    "cheese-berry": {
        "name": "Cheese Berry",
        "price": 999,
        "flavor": "Savoury-sweet",
        "badge": "New",
        "description": "A unique, savoury-sweet profile with fibre jelly — for the adventurous palate.",
        "best_for": ["adventurous", "unique flavour", "savoury", "berry lovers"],
        "ingredients": ["psyllium husk", "natural cheese flavour", "berry extract"],
    },
    "honey-black-pepper": {
        "name": "Honey Black Pepper",
        "price": 949,
        "flavor": "Warm & spiced",
        "badge": "Limited",
        "description": "A warming, slightly spiced blend intended for restorative evening teas.",
        "best_for": ["evening routine", "tea lovers", "warming", "spiced", "immunity"],
        "ingredients": ["psyllium husk", "natural honey flavour", "black pepper extract"],
    },
}

BRAND_CONTEXT = """
You are Husk, the AI wellness assistant for Husk & Co. — a premium Indian psyllium husk brand.

ABOUT HUSK & CO.:
- Founded 2025, small-batch botanical wellness brand
- All products: 150g pouches of psyllium husk, lab-tested, certified organic, non-dust formula
- Ships pan-India in 3–7 business days, free shipping on 3+ pouches or first order
- 4 products: Organic Chocolate (₹899), Pure Unflavored (₹749), Cheese Berry (₹999), Honey Black Pepper (₹949)

PSYLLIUM HUSK FACTS:
- Soluble dietary fibre from Plantago ovata seeds
- Supports: gut health, regular digestion, cholesterol management, blood sugar balance
- Non-laxative — gentle, daily-use fibre supplement
- Take: 5g (1 serving) in a full glass of water, once daily before meals
- Safe for daily use; consult doctor if you have specific conditions

YOUR PERSONALITY:
- Warm, knowledgeable, concise, friendly
- Wellness-focused — provide science-backed answers
- Never diagnose medical conditions
- Always recommend consulting a doctor for medical advice
- Speak in a natural, conversational Indian English tone
"""

# Resilient model priority list
MODELS_TO_TRY = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.8-flash",
]


# ── Client factory & model execution ───────────────────────────

@lru_cache
def _get_client() -> genai.Client:
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


def _is_enabled() -> bool:
    return get_settings().gemini_enabled


def _clean_json(text: str) -> str:
    """Strip markdown code fences from AI response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last ```
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


def _generate(
    client: genai.Client,
    contents: Any,
    config: types.GenerateContentConfig | None = None,
) -> Any:
    """Execute generate_content with automatic fallback for high availability."""
    last_err: Exception | None = None
    for model_name in MODELS_TO_TRY:
        try:
            return client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
        except Exception as e:
            last_err = e
            log.warning("Gemini model '%s' failed (%s), trying next fallback...", model_name, e)
            continue
    if last_err:
        raise last_err
    raise RuntimeError("No Gemini models available")


# ── 1. AI Chatbot — multi-turn conversation ────────────────────

async def chat_with_ai(message: str, history: list[dict]) -> str:
    """Multi-turn chat. history = [{"role": "user"|"model", "parts": "..."}]"""
    if not _is_enabled():
        return "AI assistant is not configured. Please add a Gemini API key."
    try:
        client = _get_client()
        # Build contents from history + new message
        contents = []
        for h in history:
            role = h.get("role", "user")
            part = h.get("parts", "")
            contents.append(types.Content(role=role, parts=[types.Part(text=str(part))]))
        contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

        response = _generate(
            client,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=BRAND_CONTEXT,
                max_output_tokens=1024,
                temperature=0.7,
            ),
        )
        return response.text or "I'm having trouble responding. Please try again!"
    except Exception as e:
        log.warning("Gemini chat error: %s", e)
        return "I'm having trouble connecting right now. Please try again in a moment!"


# ── 2. Product Recommendations ────────────────────────────────

async def get_product_recommendations(goal: str, preferences: str = "") -> dict:
    """Returns AI-powered product recommendations based on customer goal."""
    if not _is_enabled():
        return {"recommendations": [], "reasoning": "AI not configured"}
    try:
        client = _get_client()
        catalog_text = json.dumps(PRODUCT_CATALOG, indent=2)
        prompt = f"""
A customer is looking for: "{goal}"
Additional preferences: "{preferences}"

Our product catalog:
{catalog_text}

Recommend the best 1-3 products for this customer. Return a JSON object with:
- "recommendations": list of product IDs (e.g. ["chocolate", "unflavored"])  
- "reasoning": brief 1-2 sentence explanation of why these are best for them
- "tip": one practical usage tip relevant to their goal

Return only valid JSON, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=BRAND_CONTEXT,
                max_output_tokens=512,
                temperature=0.5,
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        log.warning("Gemini recommendations error: %s", e)
        return {"recommendations": ["unflavored"], "reasoning": "Our Pure Unflavored is a great starting point.", "tip": "Mix with your morning smoothie."}


# ── 3. AI-Powered Semantic Search ────────────────────────────

async def semantic_search(query: str) -> list[dict]:
    """Returns ranked product matches for a natural language query."""
    if not _is_enabled():
        return list(PRODUCT_CATALOG.values())
    try:
        client = _get_client()
        catalog_text = json.dumps(PRODUCT_CATALOG, indent=2)
        prompt = f"""
Customer searched for: "{query}"

Product catalog:
{catalog_text}

Return a JSON array of matching product IDs, ranked by relevance.
Each item: {{"id": "product-id", "relevance": "why this matches"}}
Return only valid JSON array, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=512, temperature=0.3),
        )
        results = json.loads(_clean_json(response.text))
        enriched = []
        for r in results:
            pid = r.get("id", "")
            if pid in PRODUCT_CATALOG:
                enriched.append({**PRODUCT_CATALOG[pid], "id": pid, "relevance": r.get("relevance", "")})
        return enriched
    except Exception as e:
        log.warning("Gemini search error: %s", e)
        return [{"id": k, **v} for k, v in PRODUCT_CATALOG.items()]


# ── 4. Review Summarizer ──────────────────────────────────────

async def summarize_reviews(product_id: str, reviews: list[str]) -> dict:
    """Generates an AI summary of customer reviews for admin dashboard."""
    if not _is_enabled():
        return {"summary": "AI not configured", "sentiment": "unknown", "highlights": []}
    if not reviews:
        return {"summary": "No reviews yet.", "sentiment": "neutral", "highlights": []}
    try:
        client = _get_client()
        product = PRODUCT_CATALOG.get(product_id, {})
        reviews_text = "\n".join(f"- {r}" for r in reviews[:50])
        prompt = f"""
Analyze these customer reviews for "{product.get('name', product_id)}" psyllium husk:

{reviews_text}

Return a JSON object:
- "summary": 2-3 sentence overview of customer sentiment
- "sentiment": "positive" | "mixed" | "negative"
- "sentiment_score": 1-10 (10 = very positive)
- "highlights": list of 3-5 key themes customers mention (both positive and negative)
- "improvement": one actionable suggestion for the product/brand

Return only valid JSON, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=600, temperature=0.4),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        log.warning("Gemini review summary error: %s", e)
        return {"summary": "Unable to generate summary.", "sentiment": "unknown", "highlights": []}


# ── 5. Product Description Generator ─────────────────────────

async def generate_product_description(
    product_id: str,
    tone: str = "premium",
    length: str = "short",
) -> dict:
    """Generates marketing copy for a product."""
    if not _is_enabled():
        return {"description": "AI not configured", "tagline": ""}
    try:
        client = _get_client()
        product = PRODUCT_CATALOG.get(product_id)
        if not product:
            return {"description": "Product not found.", "tagline": ""}
        length_guide = {"short": "2-3 sentences", "medium": "1 paragraph (5-6 sentences)", "long": "2 paragraphs"}
        prompt = f"""
Write a {tone} product description for:
Product: {product['name']}
Flavor: {product['flavor']}
Best for: {', '.join(product['best_for'])}
Ingredients: {', '.join(product['ingredients'])}
Price: ₹{product['price']}
Brand: Husk & Co. — premium, certified organic psyllium husk

Length: {length_guide.get(length, '2-3 sentences')}
Tone: {tone} (premium = luxury/sophisticated, friendly = warm/casual, scientific = clinical/evidence-based)

Return a JSON object:
- "description": the product description
- "tagline": a punchy 5-8 word tagline
- "seo_keywords": list of 5 relevant search keywords

Return only valid JSON, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=512, temperature=0.7),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        log.warning("Gemini description gen error: %s", e)
        return {"description": product.get("description", ""), "tagline": "", "seo_keywords": []}


# ── 6. Order Status Bot ───────────────────────────────────────

async def answer_order_query(
    customer_message: str,
    order_data: dict | None = None,
) -> str:
    """Answers customer order queries in natural language."""
    if not _is_enabled():
        return "AI assistant is not configured."
    try:
        client = _get_client()
        order_context = ""
        if order_data:
            order_context = f"""
Customer's order details:
- Order ID: {order_data.get('order_id', 'N/A')}
- Status: {order_data.get('status', 'N/A')}
- Items: {order_data.get('items', 'N/A')}
- Total: ₹{order_data.get('grand_total', 'N/A')}
- Placed on: {order_data.get('created_at', 'N/A')}
- Customer: {order_data.get('customer_name', 'N/A')}
"""
        prompt = f"""
{order_context}

Customer message: "{customer_message}"

Respond helpfully about their order. If order data is provided, use it.
If no order data, ask them to provide their Order ID (format: HK-XXXXXXXX-XXXXXX).
Keep response concise, friendly, and helpful.
Standard shipping takes 3-7 business days.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=BRAND_CONTEXT,
                max_output_tokens=400,
                temperature=0.5,
            ),
        )
        return response.text or "I'm unable to process your request. Please contact support@huskandco.in"
    except Exception as e:
        log.warning("Gemini order query error: %s", e)
        return "I'm having trouble accessing order information right now. Please contact us at support@huskandco.in"


# ── 7. Health FAQ Assistant ───────────────────────────────────

async def answer_health_faq(question: str) -> dict:
    """Answers health/wellness questions about psyllium husk."""
    if not _is_enabled():
        return {"answer": "AI not configured", "disclaimer": ""}
    try:
        client = _get_client()
        prompt = f"""
Health/wellness question: "{question}"

Answer this question about psyllium husk and gut health as a knowledgeable wellness advisor.
Be helpful, science-backed, but NEVER diagnose or replace medical advice.

Return a JSON object:
- "answer": clear, helpful answer (2-4 sentences)
- "is_medical": true if this requires doctor consultation, false otherwise
- "related_products": list of product IDs from [chocolate, unflavored, cheese-berry, honey-black-pepper] that are relevant (can be empty)
- "disclaimer": if is_medical=true, include "Always consult a qualified healthcare professional for medical advice."

Return only valid JSON, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=BRAND_CONTEXT,
                max_output_tokens=512,
                temperature=0.4,
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        log.warning("Gemini health FAQ error: %s", e)
        return {
            "answer": "Psyllium husk is a natural soluble fibre that supports gut health and regular digestion.",
            "is_medical": False,
            "related_products": ["unflavored"],
            "disclaimer": "",
        }


# ── 8. Admin Content Generator ────────────────────────────────

async def generate_admin_content(
    content_type: str,
    topic: str,
    tone: str = "professional",
) -> dict:
    """Generates blog posts, marketing copy, email campaigns, social posts for admin."""
    if not _is_enabled():
        return {"content": "AI not configured", "title": ""}
    try:
        client = _get_client()
        type_guides = {
            "blog": "Write a full blog post with H2 subheadings. Include an intro, 3-4 sections, and conclusion.",
            "email": "Write a marketing email with Subject, Preheader, Body, and CTA.",
            "social": "Write 3 variations: Instagram caption, Twitter/X post, LinkedIn post.",
            "whatsapp": "Write a concise WhatsApp broadcast message (under 200 words).",
            "ad_copy": "Write 3 short ad copy variations (Google Ads style, max 90 chars each).",
        }
        guide = type_guides.get(content_type, "Write the requested content.")
        prompt = f"""
Content type: {content_type}
Topic/Focus: "{topic}"
Tone: {tone}
Brand: Husk & Co. — premium certified organic psyllium husk wellness brand from India
Products: Organic Chocolate (₹899), Pure Unflavored (₹749), Cheese Berry (₹999), Honey Black Pepper (₹949)

{guide}

Return a JSON object:
- "title": headline/subject line
- "content": the full generated content
- "word_count": approximate word count

Return only valid JSON, no markdown.
"""
        response = _generate(
            client,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=BRAND_CONTEXT,
                max_output_tokens=2048,
                temperature=0.8,
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        log.warning("Gemini content gen error: %s", e)
        return {"content": "Unable to generate content.", "title": topic, "word_count": 0}
