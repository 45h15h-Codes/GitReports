import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import authRoutes          from './routes/auth';
import reportRoutes        from './routes/reports';
import { getRedisClient } from './lib/redis';
import { startReportWorker }    from './workers/reportWorker';
import { startNarrativeWorker } from './workers/narrativeWorker';
import { sql } from 'drizzle-orm';
import { db } from './db/client';


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
  await app.register(import('@fastify/rate-limit'), {
    global:     true,
    max:        100,
    timeWindow: 60_000,
    redis:      getRedisClient(),
    keyGenerator: (req) =>
      (req.session?.get('userId') as string | undefined) ?? req.ip,
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

  // ── Soft env warnings (non-fatal) ────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — emails will not be sent')
  }

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(reportRoutes);

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async (req, reply) => {
    try {
      await db.execute(sql`SELECT 1`)
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
    } catch (err) {
      return reply.status(503).send({ status: 'error', message: 'Database unavailable' })
    }
  })

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`GitReport API listening on ${HOST}:${PORT}`);

    // Start async BullMQ workers (Sprint D.3 — fully async pipeline)
    // In production, run these in a separate worker process (Sprint E.1).
    try {
      startReportWorker();
      startNarrativeWorker();
      app.log.info('[workers] Report + Narrative workers started');
    } catch (workerErr) {
      // Workers failing must not crash the API server
      app.log.error({ err: workerErr }, '[workers] Failed to start workers — jobs will queue but not process');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
