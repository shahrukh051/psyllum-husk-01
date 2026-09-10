/* =============================================================
   ecosystem.config.js — PM2 process manager config
   Run in production:  npx pm2 start ecosystem.config.js
   Monitor:            npx pm2 monit
   Logs:               npx pm2 logs husk-co
   Stop:               npx pm2 stop husk-co
   ============================================================= */

module.exports = {
  apps: [
    {
      name:             'husk-co',
      script:           './server.js',
      exec_mode:        'fork',          // cluster mode is handled inside server.js itself
      instances:        1,               // one PM2 process — server.js spawns workers internally
      autorestart:      true,
      watch:            false,           // never watch in production
      max_memory_restart: '1G',          // restart if process exceeds 1GB RAM

      env_production: {
        NODE_ENV:              'production',
        PORT:                  3000,
        RATE_LIMIT_MAX:        100,
        RATE_LIMIT_WINDOW_MS:  60000,
      },

      /* Logging */
      log_date_format:  'YYYY-MM-DD HH:mm:ss',
      error_file:       './logs/error.log',
      out_file:         './logs/out.log',
      merge_logs:       true,

      /* Zero-downtime reload */
      kill_timeout:     5000,            // wait 5s before SIGKILL
      listen_timeout:   10000,           // wait 10s for app to listen before marking as failed
    },
  ],
};
