# =============================================================
# psyllum.py — Universal compatibility entrypoint for Render
# =============================================================

from backend.main import app

application = app
husk = app

__all__ = ["app", "application", "husk"]
