# Backend Architecture Audit: GitReport API

**Date:** 2026-06-08
**Focus Areas:** Fastify Architecture, Route Organization, Service Boundaries, Queue Design, Redis, GitHub API, Database, Pipeline, Workers.

---


## 1. Executive Summary

The GitReport backend is built on a modern, high-performance stack using **Fastify**, **Drizzle ORM (PostgreSQL)**, and **BullMQ (Redis)**. The codebase is well-structured, particularly in its pure functional data aggregation engine and GitHub client abstractions. However, there are significant scalability concerns regarding synchronous third-party API ingestion and tight coupling of business logic within HTTP route handlers.

**Overall Architecture Priority Score:** **7.5 / 10**
*(Solid foundation, but requires refactoring for high-scale asynchronous processing and separation of concerns).*

---

## 2. Component Analysis

### 2.1 Express/Fastify Architecture

- **Implementation:** Fastify is correctly configured with standard security plugins (`@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`).
- **Session Management:** `@fastify/session` with `connect-pg-simple` correctly stores sessions in Postgres. While Redis is often preferred for sessions at scale, Postgres is perfectly adequate for this domain and reduces infrastructure dependencies.
- **Rate Limiting:** A global limit of 100 req/min is set, with route-specific overrides (e.g., 10 req/min for report generation). However, the default `@fastify/rate-limit` uses an in-memory store. In a multi-node deployment, rate limits will not be synchronized across instances.

### 2.2 Route Organization & Service Boundaries

- **Implementation:** Routes are split logically (`auth.ts`, `reports.ts`).
- **Tight Coupling:** The HTTP route handlers (specifically in `reports.ts`) are extremely "fat". They contain direct database queries (`db.select()`, `db.insert()`, `db.delete()`), session extraction, payload assembly, and BullMQ queue enqueueing.
- **Missing Abstractions:** There is no dedicated `ReportService` or `UserService` to encapsulate business logic. This makes the route handlers hard to unit test in isolation and violates the Single Responsibility Principle.

### 2.3 Queue Design & Worker Architecture

- **Implementation:** BullMQ is used for the `narrativeWorker`, connecting via `ioredis`. The queue is configured with exponential backoff and job retention limits.
- **Job Lifecycle:** The worker correctly updates database status (`generating` -> `complete` or `failed`), ensuring idempotent processing.
- **Process Model:** By default, `startNarrativeWorker()` is invoked inside `index.ts` within the main web server process. While acceptable for MVP, running CPU/Network-bound workers in the same Node.js event loop as the web server can degrade HTTP response times under load.
- **Missing Abstraction:** No graceful shutdown handling for the BullMQ worker in the event of `SIGTERM`/`SIGINT`.

### 2.4 GitHub API Integration

- **Implementation:** `github/client.ts` abstracts the `fetch` logic well, handling pagination and rate-limit headers (`Retry-After`, `X-RateLimit-Reset`).
- **Failure Point:** It handles `202 Accepted` for contributor stats by returning `null`, expecting the caller to retry. If the caller does not implement a backoff-retry loop, the data will simply be missed.

### 2.5 Database Schema (Drizzle ORM)

- **Implementation:** Clean and relational. Uses Postgres JSONB effectively for the AI payload, allowing schema evolution via `payloadVersion`.
- **Integrity Risk:** In `reports.ts`, generating a new report deletes the existing record and inserts a new one:
  ```typescript
  await db.delete(reports).where(...);
  const [report] = await db.insert(reports).values(...);
  ```

  If the `insert` fails or the server crashes between these two operations, the user's historical report data is permanently lost.

### 2.6 Report Generation Pipeline

- **Implementation:** Combines data fetching, functional aggregation, and LLM narrative queuing.
- **Critical Bottleneck:** The GitHub data ingestion (`ingestMonthlyData`) runs **synchronously** inside the `POST /reports/generate` route handler. Fetching commits and stats for users with hundreds of repositories can take 10-30+ seconds. This will cause HTTP timeouts (from the client or reverse proxy) and tie up Fastify connections.

---

## 3. Identified Risks & Vulnerabilities

| Category               | Issue                                                               | Impact                                                        |
| :--------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------ |
| **Scalability**  | Synchronous GitHub API ingestion in HTTP POST route.                | **High.** Long-running requests will time out.          |
| **Reliability**  | Delete-then-insert pattern for report generation.                   | **High.** Potential data loss if the insert fails.      |
| **Architecture** | Fat controllers. Business logic and DB calls inside Fastify routes. | **Medium.** Hard to maintain and test.                  |
| **Scalability**  | Web server and BullMQ worker sharing the same Node.js process.      | **Medium.** Event loop blocking under load.             |
| **Scalability**  | In-memory rate limiting.                                            | **Low.** Rate limits are bypassed in multi-node setups. |

---

## 4. Refactoring Opportunities

1. **Fully Asynchronous Pipeline (Highest Priority)**

   - Move the *entire* report generation pipeline (`ingestMonthlyData` + `aggregateMonthlyData`) into a BullMQ worker.
   - `POST /reports/generate` should only validate the request, enqueue a `generate-report` job, and return `202 Accepted`.
   - The frontend should poll `/reports/:period/status` for both ingestion progress and narrative generation.
2. **Service Layer Extraction**

   - Create `src/services/ReportService.ts` and move database interactions (find, upsert, delete, toggle visibility) out of `reports.ts`.
   - Create `src/services/UserService.ts` to handle token decryption and user fetching.
3. **Safe Database Upserts**

   - Replace the `delete()` + `insert()` pattern with Drizzle's `onConflictDoUpdate()` to ensure atomicity and prevent data loss.
4. **Worker Isolation & Graceful Shutdown**

   - Move the worker startup to a dedicated entry point (e.g., `src/worker.ts`).
   - Implement graceful shutdown listeners for `SIGTERM` to call `worker.close()`.
5. **Redis Rate Limiting**

   - Update `@fastify/rate-limit` to use the existing `ioredis` connection rather than the default memory store to support horizontal scaling.
