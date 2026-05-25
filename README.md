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
| UI Animation | Framer Motion |
| Canvas/Sequence Animation | GSAP + ScrollTrigger |
| Backend | Node.js + Fastify |
| AI | Anthropic Claude API (Haiku) |
| Database | PostgreSQL + Drizzle ORM |
| Cache | Redis (BullMQ + session) |
| Auth | GitHub OAuth 2.0 |
| Icons | Phosphor Icons (thin) |
| Type | Fraunces + DM Mono |

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

## Development Roadmap

| Phase | Milestone | Status |
|---|---|---|
| **Sprint 1** | Monorepo + DB schema + GitHub OAuth | ✅ Complete |
| **Sprint 2** | GitHub API client + Aggregation math | 🔄 Next |
| **Sprint 3** | category_signal + focus_score + persona derivation | ⏳ Pending |
| **Sprint 4** | LLM call + payload storage + report assembly | ⏳ Pending |
| **Sprint 5** | Dashboard UI (fast mode) + stat cards + commit chart | ⏳ Pending |
| **Sprint 6** | Dev Card + Cinematic mode + Challenge Link + Public report | ⏳ Pending |

## Security

- GitHub OAuth tokens are **AES-256-GCM encrypted** at rest
- All GitHub API calls are **server-side only** — tokens never reach client JS
- Private repository data is **server-rendered absent** from all public surfaces (not CSS-hidden)
- Session cookies are **httpOnly** — JavaScript cannot access them
- `prefers-reduced-motion` respected across all animations

---

*GitReport v3.0 — Built with the PRD at docs/GitReport_PRD_v3.md*
