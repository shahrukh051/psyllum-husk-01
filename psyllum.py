# =============================================================
# psyllum.py — Universal compatibility entrypoint for Render
# =============================================================

from backend.main import app

# Multiple aliases let different deployment platforms find the ASGI app by their expected name
application = app
husk = app

__all__ = ["app", "application", "husk"]
