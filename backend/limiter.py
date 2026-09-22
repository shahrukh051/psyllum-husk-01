# =============================================================
# backend/limiter.py — shared slowapi rate limiter instance
#
# Pulled into its own module so admin.py / auth.py can import
# `limiter` without creating a circular import through main.py.
# =============================================================

from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.config import get_settings

_settings = get_settings()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{_settings.rate_limit_max}/minute"],  # e.g. "100/minute" from .env
)
