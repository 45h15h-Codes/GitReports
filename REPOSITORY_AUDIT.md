# GitReport Repository Audit

## Overview
This document contains a comprehensive audit of the GitReport monorepo (`apps/api`, `apps/web`, database schema, queue workers, authentication, integration pipelines, and React frontend).

---

## Findings

### 1. Session Fixation Vulnerability
- **Severity**: High
- **Category**: Security
- **File**: `apps/api/src/routes/auth.ts`
- **Line numbers**: 90-95
- **Impact**: Attackers can hijack user sessions by forcing a known session ID prior to authentication, as the session ID remains unchanged after login.
- **Root cause**: The fastify-session ID is not regenerated upon successful user authentication during the GitHub OAuth callback.
- **Recommended fix**: Call `req.session.regenerate()` to issue a new session cookie before executing `req.session.set('userId', user.id)`.

### 2. Race Condition & Resource Exhaustion on Report Generation
- **Severity**: High
- **Category**: Performance
- **File**: `apps/api/src/routes/reports.ts`
- **Line numbers**: 112-172
- **Impact**: Concurrent POST requests while a report is "pending" or "generating" will bypass the completion check, delete the row, and trigger redundant GitHub API ingests and duplicate LLM narrative generation jobs. This risks API rate limit bans and unnecessary AI token costs.
- **Root cause**: The endpoint deletes and recreates the report row if the existing status is not strictly "complete", lacking proper idempotency/locking.
- **Recommended fix**: Return a `429 Too Many Requests` or `202 Accepted` immediately if `existing.narrativeStatus` is `'pending'` or `'generating'`.

### 3. Incomplete UTF-8 Decoding on Decryption
- **Severity**: Medium
- **Category**: Reliability
- **File**: `apps/api/src/lib/crypto.ts`
- **Line numbers**: 54
- **Impact**: Multi-byte UTF-8 characters at the boundary of a buffer chunk could be corrupted during implicit string concatenation.
- **Root cause**: Calling `decipher.update(encrypted)` without an output encoding returns a Buffer, which is implicitly cast to a string using default concatenation.
- **Recommended fix**: Explicitly specify the output encoding: `decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')`.

### 4. Inconsistent React File Extensions
- **Severity**: Low
- **Category**: Code Quality
- **File**: `apps/web/src/components/ProfileCard.jsx`
- **Line numbers**: Global
- **Impact**: Bypasses TypeScript compiler checks for this component, leading to potential type safety issues and inconsistent developer experience within a TS monorepo.
- **Root cause**: The file was either created as `.jsx` or missed during a TypeScript migration.
- **Recommended fix**: Rename the file to `ProfileCard.tsx` and define strict TypeScript interfaces for all component props.

### 5. Partial Data Ingestion Leading to Inaccurate Reports
- **Severity**: High
- **Category**: Reliability
- **File**: `apps/api/src/routes/reports.ts`
- **Line numbers**: 152-158
- **Impact**: If the GitHub API rate limit is hit mid-ingestion but some repositories were already processed (`repos.length > 0`), the system generates and stores a mathematically inaccurate report for the month.
- **Root cause**: The endpoint only returns a 503 error if `ingestion.rateLimitHit` is true AND `ingestion.repos.length === 0`.
- **Recommended fix**: Reject report generation entirely if `ingestion.rateLimitHit` is true, or explicitly flag the report as "partial" in the database payload to warn the user.

### 6. Missing Database Error Handling in Worker
- **Severity**: Medium
- **Category**: Maintainability
- **File**: `apps/api/src/workers/narrativeWorker.ts`
- **Line numbers**: 115-122
- **Impact**: If the database update fails when marking a job as "failed", the report remains "pending" indefinitely, resulting in a degraded UI experience that never resolves.
- **Root cause**: The `catch` block on `db.update` only logs the error via `console.error` and fails to trigger any upstream retry logic or halt execution.
- **Recommended fix**: Throw the error to allow BullMQ's built-in retry mechanism to handle the database failure, and utilize Fastify's structured logger instead of standard console logging.

### 7. Monolithic Connection Pool Exhaustion Risk
- **Severity**: Medium
- **Category**: Scalability
- **File**: `apps/api/src/db/client.ts`
- **Line numbers**: 10-16
- **Impact**: Under high load, the shared database connection pool (max 10 connections) may be exhausted by long-running narrative worker transactions, starving the REST API of connections and causing application-wide timeouts.
- **Root cause**: The synchronous API and asynchronous BullMQ workers share the exact same `pg` pool instance and limit within a single Node process.
- **Recommended fix**: Run the narrative worker in a separate process with its own dedicated connection pool, or increase the max pool size for the unified process based on production concurrency needs.
