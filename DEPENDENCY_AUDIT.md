# Dependency Security Audit

## Executive Summary
A dependency security audit was performed across the GitReport monorepo using `pnpm audit`. The scan analyzed 632 total dependencies across the workspace.

**Findings Summary:**
- 🔴 **Critical:** 1
- 🟠 **High:** 4
- 🟡 **Moderate:** 3
- 🟢 **Low:** 1

---

## Vulnerability Details & Remediation

### 1. `vitest`
- **Severity:** 🔴 Critical
- **CVE:** GHSA-5xrq-8626-4rwp
- **Vulnerability:** When Vitest UI server is listening, arbitrary file can be read and executed (CWE-862).
- **Current Version:** `2.1.9`
- **Patched Version:** `>=4.1.0`
- **Upgrade Path:** Update `vitest` (and `@vitest/coverage-v8`, `@vitest/mocker`) to `^4.1.0` in `apps/api`.
- **Breaking Change Risks:** **High**. Major version upgrade (v2 to v4). Requires reviewing test configuration, setup files, and coverage options. Test behavior might change.

### 2. `drizzle-orm`
- **Severity:** 🟠 High
- **CVE:** GHSA-gpj5-g38j-94v9
- **Vulnerability:** SQL injection via improperly escaped SQL identifiers (CWE-89).
- **Current Version:** `0.30.10`
- **Patched Version:** `>=0.45.2`
- **Upgrade Path:** Update `drizzle-orm` to `^0.45.2` in `apps/api`. Ensure `drizzle-kit` is also updated to a compatible version (e.g., `>=0.30.x`).
- **Breaking Change Risks:** **Moderate**. Pre-1.0 minor upgrades often introduce breaking API changes in schema definitions, query builders, or migration generation. Thorough testing required.

### 3. `fastify`
- **Severity:** 🟠 High / 🟡 Moderate / 🟢 Low
- **CVEs:** GHSA-jx2c-rxcm-jvmq (High), GHSA-444r-cwp2-x5xf (Moderate), GHSA-mrq3-vjjr-p77c (Low)
- **Vulnerability:** Content-Type header tab character allows body validation bypass, Host spoofing, DoS via memory allocation.
- **Current Version:** `4.29.1`
- **Patched Version:** `>=5.8.3`
- **Upgrade Path:** Update `fastify` to `^5.8.3` in `apps/api`.
- **Breaking Change Risks:** **High**. Major version upgrade (v4 to v5). Breaking changes expected in plugin system, error handling, route registration, and default logging behavior.

### 4. `fast-uri` (via `fastify`)
- **Severity:** 🟠 High
- **CVEs:** GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc
- **Vulnerability:** Path traversal and host confusion via percent-encoded strings.
- **Current Version:** `2.4.0`
- **Patched Version:** `>=3.1.2`
- **Upgrade Path:** Inherited through `fastify`. Upgrading `fastify` to v5 will likely resolve this by bringing in a newer dependency tree. Alternatively, force resolution via `pnpm` overrides if `fastify` cannot be upgraded immediately.
- **Breaking Change Risks:** Handled via the Fastify upgrade.

### 5. `vite`
- **Severity:** 🟡 Moderate
- **CVE:** GHSA-4w7w-66w2-5vf9
- **Vulnerability:** Path Traversal in Optimized Deps `.map` Handling.
- **Current Version:** `5.4.21`
- **Patched Version:** `>=6.4.2`
- **Upgrade Path:** Update `vite` and `@vitejs/plugin-react` in `apps/web` and `apps/api` to `^6.4.2`.
- **Breaking Change Risks:** **High**. Major version upgrade (v5 to v6). Plugin ecosystem compatibility must be verified. Build process and dev server configuration may need adjustments.

### 6. `esbuild`
- **Severity:** 🟡 Moderate
- **CVE:** GHSA-67mh-4wv8-2f99
- **Vulnerability:** Enables any website to send requests to the dev server and read the response.
- **Current Version:** `0.21.5`, `0.18.20`, `0.19.12`
- **Patched Version:** `>=0.24.3`
- **Upgrade Path:** `esbuild` is largely a transitive dependency (via `vite`, `vitest`, `drizzle-kit`). Upgrading these parent packages will update `esbuild`.
- **Breaking Change Risks:** Low direct risk, but tied to the major updates of Vite and Drizzle.

---

## Action Plan

1. **Immediate Action:** Upgrade `drizzle-orm` to resolve the SQL Injection vulnerability. Run DB tests to ensure schema parity.
2. **Short-term Action:** Upgrade `fastify` to v5 to resolve the validation bypass and transitive `fast-uri` issues. This will require code refactoring.
3. **Medium-term Action:** Upgrade build tools (`vitest` to v4, `vite` to v6). Since the `vitest` critical vulnerability applies primarily to the dev/UI server and not production runtimes, it can be scheduled after fixing production SQL injection and Fastify vulnerabilities.
