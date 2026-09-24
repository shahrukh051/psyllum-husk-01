# =============================================================
# backend/config.py — centralised settings from .env
# =============================================================

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Husk & Co."
    environment: str = "development"
    debug: bool = False
    port: int = 3000
    host: str = "0.0.0.0"
    # Gunicorn forks one Uvicorn worker per logical CPU by default; override via env
    workers: int = 12

    # Rate limiting
    rate_limit_max: int = 100
    rate_limit_window: int = 60  # seconds

    # SQLite
    db_path: str = "/tmp/husk.db" if os.environ.get("VERCEL") else "data/husk.db"

    # Email (SMTP) — all optional; email sending is skipped if not set
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "Husk & Co. <noreply@huskandco.in>"

    # Razorpay — optional; payment creation is skipped if keys are not set
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Admin Panel — required, no insecure fallback. App will fail to boot
    # if these aren't set via environment variables / .env.
    admin_username: str
    admin_password: str
    admin_secret_key: str

    # Customer session signing key — intentionally SEPARATE from
    # admin_secret_key, so a bug in the customer-token code path can
    # never produce a token that verifies as an admin token.
    customer_secret_key: str

    # CORS — comma-separated list of allowed origins, e.g.
    # "https://huskandco.in,https://psyllum-husk-01.onrender.com"
    # Trailing spaces are stripped in cors_origins property below
    allowed_origins: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)


@lru_cache  # parsed once per worker process; call get_settings.cache_clear() after env changes
def get_settings() -> Settings:
    return Settings()
