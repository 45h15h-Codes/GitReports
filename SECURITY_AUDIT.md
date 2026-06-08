# Security Audit Report

**Date:** 2026-06-08
**Scope:** GitReport Monorepo (Backend APIs, Frontend Web, Database, Auth, Infrastructure)

## Executive Summary
A comprehensive security assessment of the GitReport platform was conducted, focusing on authentication, authorization, session management, and common web vulnerabilities (OWASP Top 10). The architecture demonstrates strong foundational security, including ORM-based SQL injection prevention, encryption of tokens at rest, and robust authorization checks (IDOR prevention). However, a few areas require remediation, most notably regarding session fixation and rate limiting on authentication routes.

---

## 1. High Severity

### Session Fixation Risk
- **Risk Level:** High
- **Affected Files:** `apps/api/src/routes/auth.ts`
- **Exploit Scenario:** An attacker tricks a user into authenticating using a known session ID. Because the application does not regenerate the session ID upon successful login (`GET /auth/github/callback`), the attacker retains access to the newly authenticated session.
- **Recommended Remediation:** Explicitly regenerate the session ID upon successful authentication before setting the `userId`. For `@fastify/session`, ensure the old session is destroyed and a new session ID is issued during the privilege escalation phase.

---

## 2. Medium Severity

### Inadequate Rate Limiting on Authentication Routes
- **Risk Level:** Medium
- **Affected Files:** `apps/api/src/index.ts`, `apps/api/src/routes/auth.ts`
- **Exploit Scenario:** The application relies on a global rate limit of 100 requests per minute. An attacker could flood the `/auth/github` or `/auth/github/callback` endpoints, leading to resource exhaustion, excessive database upserts, or abuse of the OAuth flow (DoS).
- **Recommended Remediation:** Implement strict, route-specific rate limiting (e.g., 5-10 requests per minute) on all authentication-related endpoints to prevent brute-forcing and resource exhaustion.

### Suboptimal Session Cookie SameSite Configuration
- **Risk Level:** Medium
- **Affected Files:** `apps/api/src/index.ts`
- **Exploit Scenario:** The session cookie is configured with `sameSite: 'lax'`. While this provides baseline protection against Cross-Site Request Forgery (CSRF) for top-level navigations, it may not be sufficient for comprehensive API security if the frontend and backend operate on the same site architecture.
- **Recommended Remediation:** If the frontend and backend share the same domain/subdomain, upgrade the session cookie to `sameSite: 'strict'`. If cross-site requests are strictly required by architecture, implement a dedicated CSRF token mechanism (e.g., Double Submit Cookie).

### Lack of Dedicated CSRF Tokens for API Mutations
- **Risk Level:** Medium
- **Affected Files:** API mutation routes (e.g., `POST /reports/generate`, `DELETE /reports/:period`)
- **Exploit Scenario:** The API relies entirely on the `SameSite` cookie attribute to prevent CSRF. If a browser has a SameSite bypass vulnerability or if the configuration is downgraded to accommodate cross-origin requests, attackers could forge state-changing requests on behalf of authenticated users.
- **Recommended Remediation:** Implement `@fastify/csrf-protection` to require a valid CSRF token in the headers for all state-changing API endpoints (POST, PUT, DELETE).

---

## 3. Low Severity

### Timing Attack Vulnerability in OAuth State Verification
- **Risk Level:** Low
- **Affected Files:** `apps/api/src/routes/auth.ts`
- **Exploit Scenario:** The OAuth state token is verified using a standard equality operator (`state !== storedState`). While exploiting this over a network is practically impossible due to network jitter and the string's length, it is technically vulnerable to timing attacks.
- **Recommended Remediation:** Use `crypto.timingSafeEqual()` when comparing security-sensitive strings, such as OAuth state tokens or cryptographic hashes.

### Permissive Content Security Policy (CSP)
- **Risk Level:** Low
- **Affected Files:** `apps/api/src/index.ts`
- **Exploit Scenario:** The API configures a Helmet CSP that allows `'unsafe-inline'` for `styleSrc`. While the API primarily serves JSON, if it ever renders HTML (e.g., fallback error pages), this could facilitate Cross-Site Scripting (XSS).
- **Recommended Remediation:** Restrict `styleSrc` to `'self'` or use nonces/hashes for inline styles to adhere to defense-in-depth principles.

---

## 4. Informational (Validated Controls)

### SQL Injection Prevention
- **Status:** Secure
- **Details:** The application correctly uses Drizzle ORM for all database interactions. No dangerous string concatenations or raw SQL queries were found. Parameterized queries effectively mitigate SQL injection risks.

### Cross-Site Scripting (XSS)
- **Status:** Secure
- **Details:** The frontend (React) natively escapes output, mitigating DOM-based XSS. No dangerous usage of `dangerouslySetInnerHTML` was found. URL parameters in `SocialShare.tsx` are correctly encoded using `encodeURIComponent`.

### Insecure Direct Object Reference (IDOR) Prevention
- **Status:** Secure
- **Details:** Routes such as `DELETE /reports/:period` and `GET /reports/:period` correctly enforce authorization by scoping database queries to the authenticated user's ID (`eq(reports.userId, userId)`). Public endpoints properly check the `isPublic` flag.

### Secrets Management & Data at Rest
- **Status:** Secure
- **Details:** Environment variables are used appropriately for all sensitive configuration. Furthermore, third-party credentials (GitHub Access Tokens) are encrypted at rest using the `encryptToken` utility before being stored in the database.

### Queue Workers and Redis
- **Status:** Secure
- **Details:** The BullMQ implementation for narrative generation (`narrativeWorker.ts`) handles Redis connections securely via environment variables. Jobs are scoped to specific report IDs, preventing unauthorized job execution.

### SSRF and Open Redirects
- **Status:** Secure
- **Details:** OAuth callback redirects use server-controlled environment variables (`process.env.FRONTEND_URL`) rather than user-supplied input. Outbound API calls (e.g., GitHub API) use hardcoded hostnames, mitigating Server-Side Request Forgery (SSRF).
