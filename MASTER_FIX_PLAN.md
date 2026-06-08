# GitReport — Master Fix Plan v2.0

**Based on all audit reports + PRD compliance gaps.**
**Sprints A→G. Hand each sprint to agent one at a time.**

---

## Sprint A1 — Critical Security (Quick Wins)

These are all low-effort, high-impact. Ship same day.

### A1.1 — Fix Session Fixation
**File:** `apps/api/src/routes/auth.ts`
**Lines:** 90–95
**Fix:** Call `req.session.regenerate()` before setting `userId` on successful OAuth callback.
```ts
// Before
req.session.set('userId', user.id)

// After
await req.session.regenerate()
req.session.set('userId', user.id)
```

### A1.2 — Upgrade `drizzle-orm` (SQL Injection CVE)
**CVE:** GHSA-gpj5-g38j-94v9
**Fix:**
```bash
cd apps/api
pnpm update drizzle-orm@^0.45.2 drizzle-kit@^0.30.0
pnpm run db:generate   # regenerate migrations if schema API changed
pnpm run typecheck     # verify no breaking changes
```

### A1.3 — Upgrade `vitest` (Arbitrary File Read CVE)
**CVE:** GHSA-5xrq-8626-4rwp
**Note:** Dev-only vulnerability, not production threat. Still fix.
```bash
cd apps/api
pnpm update vitest@^4.1.0 @vitest/coverage-v8@^4.1.0 @vitest/mocker@^4.1.0
# Review vitest.config.ts — v4 changed setup file and coverage config keys
pnpm test   # verify test suite still passes
```

### A1.4 — Fix Incomplete UTF-8 Decoding on Decryption
**File:** `apps/api/src/lib/crypto.ts`
**Line:** 54
```ts
// Before
decipher.update(encrypted) + decipher.final()

// After
decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
```

### A1.5 — Fix Timing Attack in OAuth State Verification
**File:** `apps/api/src/routes/auth.ts`
```ts
// Before
if (state !== storedState) throw new Error('Invalid state')

// After
import { timingSafeEqual } from 'crypto'
const a = Buffer.from(state)
const b = Buffer.from(storedState)
if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid state')
```

### A1.6 — Restrict CSP `styleSrc`
**File:** `apps/api/src/index.ts`
```ts
// Before
styleSrc: ["'self'", "'unsafe-inline'"]

// After
styleSrc: ["'self'"]
```

---

## Sprint A2 — Fastify v4 → v5 Upgrade

**Pull this out of Sprint A1. It is a major version upgrade with breaking changes.**
**Effort: High. Do not mix with other fixes.**

### What breaks in v5
- Route registration signatures changed
- Error handler signature changed (`error, request, reply` → `error, request, reply` but reply methods differ)
- Plugin lifecycle hooks reordered
- Default logging behavior changed

### Fix steps
```bash
cd apps/api
pnpm update fastify@^5.8.3 @fastify/session @fastify/cors @fastify/helmet @fastify/rate-limit @fastify/csrf-protection
```

**Then fix each breaking change:**

**`apps/api/src/index.ts`**
- Review `app.setErrorHandler()` signature — reply methods like `reply.code().send()` unchanged but error shape differs in v5
- Review plugin registration order — v5 enforces stricter encapsulation

**`apps/api/src/routes/auth.ts`**
- Review `req.session` API — `@fastify/session` v5 compat may change `.set()` / `.get()` to direct property access

**`apps/api/src/routes/reports.ts`**
- Review reply send patterns — v5 deprecates some chaining

**Verification:**
```bash
pnpm run typecheck   # exit 0
pnpm run lint        # exit 0
pnpm test            # all pass
# Manual: full OAuth flow, report generation, session persistence
```

---

## Sprint B — High Risk Bugs

### B.1 — Fix Race Condition on Concurrent Report Generation
**File:** `apps/api/src/routes/reports.ts`
**Lines:** 112–172
**Fix:** Return early if report is already in progress.
```ts
// Add at top of POST /reports/generate handler, before any delete
const existing = await db.select().from(reports)
  .where(and(eq(reports.userId, userId), eq(reports.period, period)))
  .limit(1)

if (existing[0]?.narrativeStatus === 'pending' ||
    existing[0]?.narrativeStatus === 'generating') {
  return reply.code(202).send({ status: existing[0].narrativeStatus, message: 'Report generation already in progress' })
}
```

### B.2 — Fix Delete-then-Insert Data Loss
**File:** `apps/api/src/routes/reports.ts`
**Fix:** Replace `delete` + `insert` with atomic upsert.
```ts
// Before
await db.delete(reports).where(...)
const [report] = await db.insert(reports).values(...)

// After — requires composite unique constraint (userId, period) on table
const [report] = await db.insert(reports)
  .values({ userId, period, ...payload })
  .onConflictDoUpdate({
    target: [reports.userId, reports.period],
    set: {
      payload:         sql`excluded.payload`,
      narrativeStatus: sql`excluded.narrative_status`,
      updatedAt:       sql`now()`,
    },
  })
  .returning()
```
**Also:** Run Drizzle migration to add unique constraint if not already present:
```ts
// In schema.ts — verify this constraint exists
uniqueIndex('user_period_idx').on(reports.userId, reports.period)
```

### B.3 — Fix Partial Ingestion Generating Inaccurate Reports
**File:** `apps/api/src/routes/reports.ts`
**Lines:** 152–158
```ts
// Before
if (ingestion.rateLimitHit && ingestion.repos.length === 0) {
  return reply.code(503).send({ error: 'GitHub rate limit hit' })
}

// After — reject entirely if rate limit hit at any point
if (ingestion.rateLimitHit) {
  return reply.code(503).send({
    error: 'GitHub rate limit hit during ingestion. Report not generated to prevent partial data. Try again when rate limit resets.',
    rateLimitReset: ingestion.rateLimitReset ?? null,
  })
}
```

### B.4 — Fix Deterministic BullMQ Job IDs
**File:** `apps/api/src/routes/reports.ts` + `apps/api/src/workers/narrativeWorker.ts`
```ts
// Before
const jobId = `narrative:${report.id}`

// After
const jobId = `narrative:${userId}:${period}`
```
**In worker — add early exit if report deleted:**
```ts
// Top of worker process function
const report = await db.select().from(reports)
  .where(eq(reports.id, job.data.reportId))
  .limit(1)

if (!report[0]) {
  // Report was deleted (user regenerated). Exit without LLM call.
  return { skipped: true }
}
```

### B.5 — Increase BullMQ `lockDuration`
**File:** `apps/api/src/workers/narrativeWorker.ts`
```ts
// Before — default 30s, LLM can exceed this
new Worker('narrative', processor, { connection })

// After
new Worker('narrative', processor, {
  connection,
  lockDuration: 120_000,   // 2 minutes — safely above max LLM timeout
})
```

### B.6 — Fix Worker `failed` Event — Only Mark Failed on Final Attempt
**File:** `apps/api/src/workers/narrativeWorker.ts`
```ts
// Before
worker.on('failed', async (job, err) => {
  await db.update(reports).set({ narrativeStatus: 'failed' })...
})

// After
worker.on('failed', async (job, err) => {
  if (!job) return
  const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
  if (!isLastAttempt) return   // transient failure — let BullMQ retry silently
  await db.update(reports).set({ narrativeStatus: 'failed' })...
})
```

### B.7 — Fix Missing DB Error Handling in Worker
**File:** `apps/api/src/workers/narrativeWorker.ts`
**Lines:** 115–122
```ts
// Before
} catch (err) {
  console.error('Failed to update report status', err)
}

// After — throw so BullMQ retry mechanism catches it
} catch (err) {
  fastify.log.error({ err, reportId }, 'Failed to update report status in DB')
  throw err   // BullMQ retries the job
}
```

### B.8 — Add `ProfileCard.jsx` → `ProfileCard.tsx`
**File:** `apps/web/src/components/ProfileCard.jsx`
**Fix:** Rename to `.tsx`. Add TypeScript interface for all props. Remove imperative pointer/deviceorientation DOM listeners — replace with Framer Motion `useMotionValue` + `useSpring` (same pattern as `DevCard.tsx`).

---

## Sprint C — Performance

### C.1 — Fix Over-fetching in `GET /reports`
**File:** `apps/api/src/routes/reports.ts`
```ts
// Before
db.select().from(reports).where(eq(reports.userId, userId))

// After — select metadata only, exclude payload JSONB
db.select({
  id:              reports.id,
  period:          reports.period,
  narrativeStatus: reports.narrativeStatus,
  persona:         reports.persona,
  isPublic:        reports.isPublic,
  createdAt:       reports.createdAt,
}).from(reports).where(eq(reports.userId, userId))
  .orderBy(desc(reports.period))
```

### C.2 — Add Missing Database Index
**File:** `apps/api/src/db/schema.ts`
```ts
// Replace existing (userId, period) index with DESC variant
index('user_period_desc_idx').on(reports.userId, desc(reports.period))

// Drop unused public index if no global public feed planned
// Remove: index('public_idx').on(reports.isPublic, reports.period)
```
Run `pnpm run db:generate && pnpm run db:migrate`.

### C.3 — Optimize GitHub API — Concurrent Fetching
**File:** `apps/api/src/services/github/client.ts`
**Fix:** Replace sequential `while` pagination with `Promise.all` where page count is known from first response.
```ts
// Pattern: fetch page 1, get total count, then fetch remaining pages concurrently
const firstPage = await ghFetch(url + '?page=1&per_page=100')
const totalPages = Math.ceil(firstPage.totalCount / 100)
const remainingPages = await Promise.all(
  Array.from({ length: totalPages - 1 }, (_, i) =>
    ghFetch(url + `?page=${i + 2}&per_page=100`)
  )
)
const all = [firstPage.data, ...remainingPages.map(p => p.data)].flat()
```

### C.4 — Redis Connection Singleton
**File:** `apps/api/src/lib/redis.ts` (create if not exists)
```ts
import IORedis from 'ioredis'

let _client: IORedis | null = null
let _subscriber: IORedis | null = null

// BullMQ requires separate connections for client vs worker
export function getRedisClient(): IORedis {
  if (!_client) _client = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
  return _client
}

export function getRedisSubscriber(): IORedis {
  if (!_subscriber) _subscriber = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
  return _subscriber
}
```
Replace all `createRedisConnection()` calls with `getRedisClient()` or `getRedisSubscriber()`.

### C.5 — Lazy-Load GSAP (Bundle Size)
**File:** `apps/web/src/pages/Dashboard.tsx`
**Fix:** GSAP only runs during cinematic first-run mode. Dynamic import it — don't ship it to every user on cold load.
```ts
// Before — static import, always in bundle
import { gsap } from 'gsap'

// After — load only when cinematic mode triggers
async function runCinematicSequence(el: HTMLElement) {
  const { gsap } = await import('gsap')
  const { ScrollTrigger } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ScrollTrigger)
  // ... cinematic sequence
}
```
Framer Motion stays as static import — used on every render for spring physics.

### C.6 — Replace Status Polling with SSE
**File:** `apps/api/src/routes/reports.ts` (new endpoint) + `apps/web/src/lib/api.ts`

**Backend — add SSE endpoint:**
```ts
fastify.get('/reports/:period/stream', async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  })

  const send = (data: object) =>
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)

  const interval = setInterval(async () => {
    const report = await db.select({ narrativeStatus: reports.narrativeStatus })
      .from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.period, req.params.period)))
      .limit(1)

    if (!report[0]) { clearInterval(interval); reply.raw.end(); return }
    send({ status: report[0].narrativeStatus })
    if (report[0].narrativeStatus === 'complete' || report[0].narrativeStatus === 'failed') {
      clearInterval(interval)
      reply.raw.end()
    }
  }, 1500)

  req.raw.on('close', () => clearInterval(interval))
})
```

**Frontend — replace polling with `EventSource`:**
```ts
function watchReportStatus(period: string, onComplete: () => void) {
  const es = new EventSource(`/api/reports/${period}/stream`)
  es.onmessage = (e) => {
    const { status } = JSON.parse(e.data)
    if (status === 'complete' || status === 'failed') {
      es.close()
      onComplete()
    }
  }
  es.onerror = () => es.close()
  return () => es.close()   // cleanup function
}
```

### C.7 — React Memoization
**Files:** `apps/web/src/components/CommitChart.tsx`, `apps/web/src/components/InsightsPanel.tsx`, `apps/web/src/pages/Dashboard.tsx`
```ts
// CommitChart — memoize bar color computation
const bars = useMemo(() =>
  dailyCommits.map((count, i) => ({
    height: count === 0 ? 4 : Math.max(8, (count / max) * 100),
    color:  barColor(count, max),
    day:    i + 1,
  })),
  [dailyCommits, max]
)

// Dashboard — memoize sorted language entries
const sortedLanguages = useMemo(() =>
  Object.entries(payload.languages).sort((a, b) => b[1] - a[1]),
  [payload.languages]
)

// Stable callbacks passed to children
const handleMonthSelect = useCallback((period: string) => {
  setSelectedPeriod(period)
}, [])
```

---

## Sprint D — Architecture

### D.1 — Fix TypeScript Build Error (`erasableSyntaxOnly`)
**File:** `apps/web/tsconfig.app.json`
```json
// Remove this line — it blocks constructor parameter properties
"erasableSyntaxOnly": true
```
**File:** `apps/web/src/lib/api.ts` — if `ApiError` uses constructor parameter properties, either keep them (after removing the flag) or rewrite:
```ts
// If you remove the tsconfig flag, constructor shorthand works fine
class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}
```

### D.2 — Fix React Anti-Pattern: Direct DOM Style Mutation
**Files:** `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/Sidebar.tsx`

Remove all `onMouseEnter`/`onMouseLeave` inline style mutations. Replace with Tailwind:
```tsx
// Before
onMouseEnter={(e) => { e.currentTarget.style.background = '#1C2128' }}
onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}

// After — Tailwind classes only
className="hover:bg-[#1C2128] transition-colors duration-150"
```

### D.3 — Fully Async Report Pipeline
**Depends on:** B.1, B.2, B.4

Move `ingestMonthlyData` out of the HTTP route handler into BullMQ.

**`POST /reports/generate` becomes:**
```ts
// Validate → enqueue → return 202. Nothing else.
await queue.add('generate-report', { userId, period }, {
  jobId:    `report:${userId}:${period}`,
  attempts: 3,
  backoff:  { type: 'exponential', delay: 5000 },
})
return reply.code(202).send({ status: 'queued' })
```

**New worker handles full pipeline:**
```
ingestMonthlyData()
  → aggregateMonthlyData()
  → classifyRepo()
  → computeFocusScore()
  → derivePersona()
  → assemblePayload()
  → generateNarrative() [LLM call]
  → db.update(reports, { status: 'complete' })
```

**Frontend polls SSE endpoint** (wired in C.6) for status updates during this async flow.

### D.4 — Extract Service Layer
**New files:**
- `apps/api/src/services/ReportService.ts` — find, upsert, delete, toggle visibility, fetch by period
- `apps/api/src/services/UserService.ts` — fetch user, decrypt token, update last seen

Move all `db.select/insert/update/delete` calls out of `reports.ts` and `auth.ts` into these services. Route handlers become thin orchestrators: validate → call service → send reply.

### D.5 — Decompose `Dashboard.tsx` Monolith
**New files:**
- `apps/web/src/components/DashboardSkeleton.tsx` — skeleton shimmer layout matching dashboard grid
- `apps/web/src/components/NoReportsState.tsx` — empty state when user has no reports yet
- `apps/web/src/components/ErrorState.tsx` — error boundary fallback UI

Extract from `Dashboard.tsx`:
- Stats grid → already in `StatCard.tsx`, just clean up inline
- Language breakdown → `LanguageBreakdown.tsx`
- Activity meta (streaks) → `ActivityMeta.tsx`

---

## Sprint E — Scalability

### E.1 — Worker Isolation and Graceful Shutdown
**New file:** `apps/api/src/worker.ts`
```ts
// Dedicated entry point for worker process — separate from web server
import { startNarrativeWorker } from './workers/narrativeWorker'
import { getRedisClient } from './lib/redis'

const worker = startNarrativeWorker()

async function shutdown() {
  await worker.close()   // finish current job, stop accepting new ones
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
```

**`package.json` scripts:**
```json
"worker": "tsx src/worker.ts",
"dev:worker": "tsx watch src/worker.ts"
```

Remove `startNarrativeWorker()` call from `src/index.ts`.

### E.2 — Enforce Redis `noeviction` Policy
**Infrastructure change — not code.**
Set on your Redis instance:
```
maxmemory-policy noeviction
```
On Upstash: Settings → Eviction Policy → No Eviction.
On Redis Cloud: same under configuration.
**BullMQ data structures have no TTL — LRU eviction corrupts the queue.**

### E.3 — Fix Queue Rate Limit Mismatch
**File:** `apps/api/src/workers/narrativeWorker.ts`
```ts
// Before — 5 jobs/min globally, blocks at 2 concurrent users
limiter: { max: 5, duration: 60_000 }

// After — remove global limiter, use concurrency only
// Claude Haiku handles 50+ concurrent requests — concurrency: 5 is the real throttle
new Worker('narrative', processor, {
  connection,
  concurrency:  10,      // adjust based on Claude API tier
  lockDuration: 120_000,
})
```

### E.4 — Redis-Backed Rate Limiting
**File:** `apps/api/src/index.ts`
```ts
// Before — in-memory, bypassed in multi-node
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// After — Redis-backed, synchronized across nodes
await fastify.register(rateLimit, {
  max:        100,
  timeWindow: '1 minute',
  redis:      getRedisClient(),
})
```

### E.5 — Auth Route-Specific Rate Limiting
**File:** `apps/api/src/routes/auth.ts`
```ts
// Add to /auth/github and /auth/github/callback routes
{
  config: {
    rateLimit: { max: 10, timeWindow: '1 minute' }
  }
}
```

### E.6 — Implement Dead-Letter Queue
**New file:** `apps/api/src/workers/dlq.ts`
```ts
// On final job failure, persist to failed_jobs table before BullMQ prunes it
worker.on('failed', async (job, err) => {
  if (!job) return
  const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1)
  if (!isLastAttempt) return

  // Persist to DB for debugging and replay
  await db.insert(failedJobs).values({
    jobId:     job.id,
    jobName:   job.name,
    payload:   job.data,
    error:     err.message,
    stack:     err.stack,
    failedAt:  new Date(),
  })
})
```
**New table:** `failed_jobs` — add Drizzle schema + migration.

---

## Sprint F — Production Readiness

### F.1 — CI/CD Pipelines
**New file:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter api typecheck
      - run: pnpm --filter api lint
      - run: pnpm --filter api test
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm --filter web typecheck
      - run: pnpm --filter web lint
      - run: pnpm --filter web build
```

### F.2 — Dockerfiles
**`apps/api/Dockerfile`:**
```dockerfile
FROM node:20-alpine AS base
RUN npm i -g pnpm
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
RUN pnpm --filter api build

FROM node:20-alpine AS api
WORKDIR /app
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS worker
WORKDIR /app
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/node_modules ./node_modules
CMD ["node", "dist/worker.js"]
```

**`apps/web/Dockerfile`:**
```dockerfile
FROM node:20-alpine AS build
RUN npm i -g pnpm
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
```

### F.3 — Error Tracking (Sentry)
```bash
cd apps/api && pnpm add @sentry/node
cd apps/web && pnpm add @sentry/react
```

**`apps/api/src/index.ts`:**
```ts
import * as Sentry from '@sentry/node'
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 })

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error)
  fastify.log.error(error)
  reply.code(error.statusCode ?? 500).send({ error: error.message })
})
```

### F.4 — Automated Database Backups
**Not code — infrastructure:**
- Neon / Supabase / RDS: enable daily automated backups with 7-day retention in dashboard
- Add backup verification step to runbook: restore to staging monthly and verify row counts match

### F.5 — Session Cookie Hardening
**File:** `apps/api/src/index.ts`
```ts
// Before
cookie: { sameSite: 'lax', secure: true, httpOnly: true }

// After — strict if frontend/backend on same domain
cookie: { sameSite: 'strict', secure: true, httpOnly: true }
```

### F.6 — CSRF Protection
```bash
cd apps/api && pnpm add @fastify/csrf-protection
```
```ts
await fastify.register(import('@fastify/csrf-protection'))
// All POST/PUT/DELETE routes now require X-CSRF-Token header
```

### F.7 — Deep Health Check Endpoint
**File:** `apps/api/src/routes/health.ts`
```ts
fastify.get('/health', async (req, reply) => {
  const db   = await checkDbConnection()    // SELECT 1
  const redis = await checkRedisConnection() // PING
  const status = db && redis ? 'ok' : 'degraded'
  return reply.code(db && redis ? 200 : 503).send({ status, db, redis })
})
```

---

## Sprint G — Data Integrity & PRD Compliance

### G.1 — Fix `focusScore` Column Type
**File:** `apps/api/src/db/schema.ts`
```ts
// Before
focusScore: text('focus_score')

// After
focusScore: numeric('focus_score', { precision: 5, scale: 2 })
```
Run `pnpm run db:generate && pnpm run db:migrate`.
**Backfill existing rows:**
```sql
UPDATE reports SET focus_score = (payload->>'focusScore')::numeric WHERE focus_score IS NULL;
```

### G.2 — GDPR Hard-Delete Background Job
**PRD §7.1 requires full deletion within 30 days of request.**
**New file:** `apps/api/src/jobs/gdprCleanup.ts`
```ts
// Run daily via cron
export async function runGdprCleanup() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const deleted = await db.select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletedAt), lte(users.deletedAt, cutoff)))

  for (const user of deleted) {
    // Cascade deletes reports, challenge_links via ON DELETE CASCADE
    await db.delete(users).where(eq(users.id, user.id))
    // Payloads deleted immediately per PRD §9.2
  }
}
```
Wire to a cron in `apps/api/src/index.ts` or use a dedicated cron job in Docker Compose.

### G.3 — Challenge Links Expiry Cleanup Job
**PRD §9.3: links expire after 30 days.**
**New file:** `apps/api/src/jobs/challengeLinkCleanup.ts`
```ts
// Run daily
export async function cleanExpiredChallengeLinks() {
  await db.delete(challengeLinks)
    .where(lte(challengeLinks.expiresAt, new Date()))
}
```

### G.4 — Sessions Table Cleanup
`connect-pg-simple` has a built-in cleanup interval. Ensure it is configured:
```ts
// When registering connect-pg-simple
new pgSession({
  pool,
  tableName: 'sessions',
  pruneSessionInterval: 60 * 15,   // prune expired sessions every 15 minutes
})
```

### G.5 — Add Unique Constraint for `onConflictDoUpdate`
**Required by B.2 fix.**
**File:** `apps/api/src/db/schema.ts`
```ts
// Ensure this exists — required for upsert target
export const reports = pgTable('reports', {
  // ... columns
}, (table) => ({
  userPeriodUnique: uniqueIndex('user_period_unique').on(table.userId, table.period),
}))
```
Run migration. Without this, `onConflictDoUpdate` has no conflict target and will fail.

---

## Execution Order

| Sprint | Blocks | Do before launch |
|--------|--------|-----------------|
| A1 | Nothing | Yes — ship same day |
| A2 | Nothing | Yes — before public traffic |
| B | A1 done | Yes — data safety |
| C | B done | Before scale |
| D | B + C done | Before scale |
| E | C + D done | Before scale |
| F | D done | Yes — before public launch |
| G | A1 done | Yes — GDPR is legal requirement |
