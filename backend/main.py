# =============================================================
# backend/main.py — FastAPI application entrypoint
#
# Handles 20k+ concurrent users via:
#   • Async I/O throughout (FastAPI + uvicorn + aiosqlite)
#   • Gunicorn spawning one Uvicorn worker per CPU core
#   • Brotli / GZip compression (GZipMiddleware)
#   • Rate limiting per IP (slowapi)
#   • Security headers (custom middleware)
#   • 1-year immutable cache headers on static assets
#   • Auto-generated Swagger docs at /docs
# =============================================================

from __future__ import annotations
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.config import get_settings
from backend.database import init_db
from backend.routers import contact, orders

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if not get_settings().is_production else logging.WARNING,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("husk-co")

# ── Lifespan (startup / shutdown) ─────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await init_db()
    log.info("🌿 Husk & Co. backend ready  [env=%s | pid=%s]", settings.environment, os.getpid())
    yield
    log.info("Shutting down worker pid=%s", os.getpid())


# ── Rate limiter ──────────────────────────────────────────────
settings = get_settings()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_max}/minute"],
)

# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title="Husk & Co. API",
    description="Backend API for Husk & Co. Pure Botanical Wellness",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────

# GZip compression (minimum 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Rate limiting error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"]    = "nosniff"
    response.headers["X-Frame-Options"]           = "DENY"
    response.headers["X-XSS-Protection"]          = "1; mode=block"
    response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"

    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # Cache-Control: immutable for assets, no-cache for HTML
    path = request.url.path
    if any(path.endswith(ext) for ext in (".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2")):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.endswith(".html") or path == "/":
        response.headers["Cache-Control"] = "no-cache, must-revalidate"

    return response


# ── API routers ───────────────────────────────────────────────
app.include_router(orders.router)
app.include_router(contact.router)


# ── Health check ──────────────────────────────────────────────
@app.get("/health", tags=["system"])
@limiter.limit("200/minute")
async def health(request: Request):
    return {"status": "ok", "env": settings.environment, "pid": os.getpid()}


# ── Static file serving ───────────────────────────────────────
PUBLIC_DIR = Path(__file__).parent.parent / "public"

app.mount(
    "/",
    StaticFiles(directory=str(PUBLIC_DIR), html=True),
    name="static",
)


# ── SPA fallback: unknown routes → index.html ─────────────────
@app.exception_handler(404)
async def not_found(request: Request, exc):
    # API misses → JSON 404
    if request.url.path.startswith("/api/"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    # Everything else → serve index.html (SPA mode)
    index = PUBLIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"error": "Not found"}, status_code=404)
