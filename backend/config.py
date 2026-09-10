# =============================================================
# backend/config.py — centralised settings from .env
# =============================================================

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    port: int = 3000
    environment: str = "development"
    workers: int = 12

    # Rate limiting
    rate_limit_max: int = 100
    rate_limit_window: int = 60  # seconds

    # SQLite
    db_path: str = "data/husk.db"

    # Email (SMTP) — all optional; email sending is skipped if not set
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "Husk & Co. <noreply@huskandco.in>"

    # Razorpay — optional; payment creation is skipped if keys are not set
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Admin Panel
    admin_username: str = "shahrukh"
    admin_password: str = "1404"
    admin_secret_key: str = "husk-co-luxury-wellness-admin-secret-2026"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
