# =============================================================
# gunicorn.conf.py — Production process manager config
#
# Start in production:  gunicorn -c gunicorn.conf.py backend.main:app
# Dev (auto-reload):    uvicorn backend.main:app --reload --port 3000
# =============================================================

import multiprocessing

# Bind
bind        = "0.0.0.0:3000"

# Workers: one per CPU core (same as Node.js cluster)
workers     = multiprocessing.cpu_count()
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout          = 30   # kill worker if silent for 30s
graceful_timeout = 10   # wait 10s for in-flight requests on reload
keepalive        = 5    # keep TCP connection alive for 5s

# Logging
loglevel    = "warning"
accesslog   = "logs/access.log"
errorlog    = "logs/error.log"

# Auto-restart workers after N requests (prevents memory leaks)
max_requests        = 1000
max_requests_jitter = 100   # randomise to avoid thundering herd

# Process naming
proc_name   = "husk-co"
