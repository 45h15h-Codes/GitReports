import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import rateLimit from '@fastify/rate-limit';
import authRoutes          from './routes/auth';
import reportRoutes        from './routes/reports';
import { startNarrativeWorker } from './workers/narrativeWorker';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ── Security headers ──────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'"],
        imgSrc:      ["'self'", 'data:', 'https://avatars.githubusercontent.com'],
        connectSrc:  ["'self'"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
      },
    },
  });

  // ── CORS ─────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ── Rate limiting (global) ────────────────────────────────────────────────
  // Per-route tighter limits applied in individual route handlers
  await app.register(rateLimit, {
    max:      100,
    timeWindow: '1 minute',
  });

  // ── Cookies + Sessions ───────────────────────────────────────────────────
  await app.register(cookie);
  await app.register(session, {
    secret:      process.env.SESSION_SECRET!,
    cookie: {
      secure:   process.env.NODE_ENV === 'production',
      httpOnly: true,           // JS cannot access the session cookie — ever
      sameSite: 'lax',
      maxAge:   30 * 24 * 60 * 60 * 1000,  // 30 days
    },
    saveUninitialized: false,
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(reportRoutes);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', version: '3.0.0' }));

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`GitReport API listening on ${HOST}:${PORT}`);

    // Start async BullMQ workers (Sprint 3 — narrative generation)
    // In production, run these in a separate worker process.
    if (process.env.START_WORKERS !== 'false') {
      startNarrativeWorker();
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
