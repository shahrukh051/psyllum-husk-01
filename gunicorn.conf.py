# =============================================================
# gunicorn.conf.py — Production process manager config
#
# Start in production:  gunicorn -c gunicorn.conf.py backend.main:app
# Dev (auto-reload):    uvicorn backend.main:app --reload --port 3000
# =============================================================

import os
import multiprocessing
from pathlib import Path

# Ensure logs directory exists if file logging is used
Path("logs").mkdir(parents=True, exist_ok=True)

# Bind: support Render / Heroku / container PORT environment variable
port = os.environ.get("PORT", "3000")
bind = f"0.0.0.0:{port}"

# Workers: one per CPU core (safe fallback for shared container cores)
workers = max(1, min(multiprocessing.cpu_count(), 4))
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout          = 30   # kill worker if silent for 30s
graceful_timeout = 10   # wait 10s for in-flight requests on reload
keepalive        = 5    # keep TCP connection alive for 5s

# Logging: on cloud platforms like Render, stdout/stderr streams to the dashboard
if os.environ.get("RENDER") or not os.path.isdir("logs"):
    accesslog = "-"
    errorlog  = "-"
else:
    accesslog = "-"
    errorlog  = "-"

# Auto-restart workers after N requests (prevents memory leaks)
max_requests        = 1000
max_requests_jitter = 100   # randomise to avoid thundering herd

# Process naming
proc_name   = "husk-co"
