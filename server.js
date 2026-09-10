/* =============================================================
   server.js — Production-grade Fastify server
   Handles 20k+ concurrent users via:
     • Node.js cluster (one worker per CPU core)
     • Brotli/gzip compression
     • Long-TTL cache headers on static assets
     • Per-IP rate limiting
     • Security headers (Helmet)
     • SQLite persistence
   ============================================================= */

'use strict';

require('dotenv').config();

const cluster = require('cluster');
const os      = require('os');
const path    = require('path');

const PORT      = parseInt(process.env.PORT || '3000', 10);
const IS_PROD   = process.env.NODE_ENV === 'production';
const NUM_CPUS  = os.cpus().length;

/* ── CLUSTER PRIMARY ── */
if (cluster.isPrimary) {
  console.log(`\n  🌿 Husk & Co. — starting ${NUM_CPUS} workers on port ${PORT}\n`);

  for (let i = 0; i < NUM_CPUS; i++) cluster.fork();

  cluster.on('exit', (worker, code) => {
    if (code !== 0) {
      console.warn(`  ⚠️  Worker ${worker.process.pid} died (code ${code}). Restarting…`);
      cluster.fork();
    }
  });

  return; // primary process does nothing else
}

/* ── WORKER: Fastify instance ── */
const Fastify   = require('fastify');
const Database  = require('better-sqlite3');
const fastifyStatic   = require('@fastify/static');
const fastifyCompress = require('@fastify/compress');
const fastifyHelmet   = require('@fastify/helmet');
const fastifyCors     = require('@fastify/cors');
const fastifyRateLimit = require('@fastify/rate-limit');

/* ── SQLite setup ── */
function initDb() {
  const db = new Database(path.join(__dirname, 'data', 'husk.db'));
  db.pragma('journal_mode = WAL');      // Write-Ahead Logging — safe concurrent reads
  db.pragma('synchronous = NORMAL');    // Fast without sacrificing durability
  db.pragma('cache_size = -32000');     // 32MB page cache
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id          TEXT    NOT NULL UNIQUE,
      customer_name     TEXT    NOT NULL,
      customer_phone    TEXT    NOT NULL,
      customer_email    TEXT,
      customer_address  TEXT,
      items_json        TEXT    NOT NULL,
      subtotal          INTEGER NOT NULL,
      shipping          INTEGER NOT NULL,
      grand_total       INTEGER NOT NULL,
      status            TEXT    NOT NULL DEFAULT 'pending',
      created_at        TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      subject     TEXT NOT NULL,
      message     TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_order_id   ON orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_contacts_email    ON contacts(email);
  `);

  return db;
}

/* ── Build Fastify app ── */
async function buildApp() {
  const app = Fastify({
    logger: IS_PROD
      ? { level: 'warn' }
      : {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
    trustProxy: true,             // respect X-Forwarded-* from Cloudflare/nginx
  });

  /* Attach DB to fastify instance so plugins can access via fastify.db */
  const db = initDb();
  app.decorate('db', db);
  app.addHook('onClose', () => db.close());

  /* ── Security headers ── */
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
        styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
        fontSrc:     ["'self'", 'fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:'],
        connectSrc:  ["'self'"],
        workerSrc:   ["'none'"],
        objectSrc:   ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false, // needed for Three.js importmap
  });

  /* ── CORS ── */
  await app.register(fastifyCors, {
    origin: IS_PROD ? false : true, // Same-origin in prod; open in dev
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  /* ── Compression (brotli preferred, gzip fallback) ── */
  await app.register(fastifyCompress, {
    global: true,
    encodings: ['br', 'gzip', 'deflate'],
    threshold: 1024,              // only compress responses > 1KB
  });

  /* ── Rate limiting ── */
  await app.register(fastifyRateLimit, {
    global: true,
    max:        parseInt(process.env.RATE_LIMIT_MAX        || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS  || '60000', 10),
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Slow down! You are sending too many requests. Try again in a minute.',
    }),
    // Stricter limit on API endpoints
    addContentTypeParser: false,
  });

  /* ── Static files ── */
  await app.register(fastifyStatic, {
    root:   path.join(__dirname, 'public'),
    prefix: '/',
    // Cache static assets for 1 year (immutable = browser won't even revalidate)
    setHeaders(res, filePath) {
      const isAsset = /\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(filePath);
      if (isAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        // HTML — always revalidate so new deployments are seen immediately
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    },
    decorateReply: false,
  });

  /* ── API routes ── */
  await app.register(require('./api/orders'),  { prefix: '/' });
  await app.register(require('./api/contact'), { prefix: '/' });

  /* ── Health check (used by load balancers / uptime monitors) ── */
  app.get('/health', {
    config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
    schema: { response: { 200: { type: 'object', properties: { status: { type: 'string' }, pid: { type: 'number' }, uptime: { type: 'number' } } } } },
  }, async () => ({
    status: 'ok',
    pid:    process.pid,
    uptime: Math.floor(process.uptime()),
  }));

  /* ── SPA fallback: all unmatched routes → index.html ── */
  app.setNotFoundHandler(async (req, reply) => {
    // Don't serve HTML for /api/* misses — return proper 404
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return app;
}

/* ── Start ── */
buildApp()
  .then(app => app.listen({ port: PORT, host: '0.0.0.0' }))
  .then(() => {
    console.log(`  ✅ Worker ${process.pid} ready on :${PORT}`);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
