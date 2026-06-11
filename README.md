# GitReport v3.0

> **Developer Identity Engine & Monthly Engineering Intelligence Platform**

GitReport transforms raw GitHub activity into a narrative — a monthly story of what was built, how hard it was, and what kind of engineer you're becoming. Then it makes you want to share that story.

---

## Architecture

```
gitreport/
├── apps/
│   ├── web/          # React + TypeScript (Vite) — Dashboard, Dev Card, public surfaces
│   └── api/          # Node.js + Fastify — Aggregation engine, LLM orchestration, GitHub OAuth
├── docs/
│   ├── GitReport_PRD_v3.md   # Product Requirements Document v3.0
│   └── design.md             # Design System & Competitive Positioning
└── scripts/                  # Tooling scripts
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| State Management | TanStack Query v5 |
| Styling | Tailwind CSS v3 |
| UI Animation | Framer Motion |
| Canvas/Sequence Animation | GSAP + ScrollTrigger |
| Backend | Node.js + Fastify |
| AI | Anthropic Claude API (Haiku) |
| Database | PostgreSQL + Drizzle ORM |
| Queue/Redis | BullMQ + ioredis |
| Auth | GitHub OAuth 2.0 + @fastify/session |
| Icons | Phosphor Icons (thin) |
| Type | Fraunces + DM Mono (Fontsource) |

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- Redis instance ([Upstash](https://upstash.com) recommended)
- GitHub OAuth App ([create one here](https://github.com/settings/developers))

### Setup

```bash
# Install all workspace dependencies
pnpm install

# Configure environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill in DATABASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, TOKEN_ENCRYPTION_KEY

# Generate encryption keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # TOKEN_ENCRYPTION_KEY

# Run DB migrations
pnpm db:migrate

# Start development servers (both api + web in parallel)
pnpm dev
```

The API runs on `http://localhost:3001`, the web app on `http://localhost:5173`.

## Current Status (Development)

| Phase | Milestone | Status |
|---|---|---|
| **Security Audits** | Comprehensive audit reports + Sprint A1 fixes applied | ✅ Complete |
| **Sprint 1** | Monorepo + DB schema + GitHub OAuth | ✅ Complete |
| **Sprint 2** | GitHub API client + Aggregation math | ✅ Complete |
| **Sprint 3** | category_signal + focus_score + persona derivation | ✅ Complete |
| **Sprint 4** | LLM call + payload storage + report assembly | ✅ Complete |
| **Sprint 5** | Dashboard UI + React Query + Tailwind CSS | ✅ Complete |
| **Sprint 6** | Dev Card + Challenge Link + Public report | ✅ Complete |
| **Sprint 7** | Fastify v5 + Async pipeline + SSE streaming | ⏳ Pending |
| **Sprint 8** | Security hardening + CSP + CSRF + Rate limits | ⏳ Pending |
| **Sprint 9** | Production readiness + CI/CD + Docker | ⏳ Pending |

## Security

- GitHub OAuth tokens are **AES-256-GCM encrypted** at rest
- All GitHub API calls are **server-side only** — tokens never reach client JS
- Private repository data is **server-rendered absent** from all public surfaces (not CSS-hidden)
- Session cookies are **httpOnly** — JavaScript cannot access them
- `prefers-reduced-motion` respected across all animations

## Production Roadmap

- **Complete Security Suite**: All Sprint A-G fixes implemented (session hardening, CSRF protection, Redis-backed rate limiting, dead-letter queues)
- **Full Async Pipeline**: BullMQ workers handling all report generation without blocking HTTP handlers
- **Live Progress Updates**: Server-Sent Events (SSE) streaming for real-time report generation status
- **Scalable Infrastructure**: Redis singleton pattern, connection pooling, graceful worker shutdown
- **CI/CD Pipeline**: Automated testing, linting, and deployment via GitHub Actions
- **GDPR Compliance**: Automated data deletion within 30 days, challenge link expiry
- **Monitoring**: Deep health checks, error tracking, database backups

## Free to Use

GitReport is completely free for individual developers.

**What you get for free:**
- Unlimited monthly report generations for **public repositories**
- Full dashboard with statistics, streaks, and language breakdown
- Cinematic Dev Card mode with shareable links
- Challenge links to compare with friends
- All core features with no restrictions

**Setup:**
1. Create a GitHub OAuth app (free)
2. Use any PostgreSQL provider (Neon free tier works)
3. Use any Redis provider (Upstash free tier works)
4. Sign in — your reports generate automatically

No credit card required. No usage limits. Just connect your GitHub and see your monthly developer story.

---

*GitReport v3.0 — Built with the PRD at docs/GitReport_PRD_v3.md. Security audit reports in `docs/` and `*.md` root files.*
