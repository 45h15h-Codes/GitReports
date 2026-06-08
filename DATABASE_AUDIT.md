# Database Audit

## 1. Schema
- 4 core tables: `users`, `reports`, `challenge_links`, `sessions`.
- ORM: Drizzle ORM.
- DB: PostgreSQL.
- Payload versioning (`payloadVersion`) inside `reports` good for schema evolution.

## 2. Indexes & Foreign Keys
- Foreign keys correct. `ON DELETE CASCADE` used for `userId` in `reports` and `challenge_links`.
- Indexes generally good. `users.github_id`, `users.username`, `challenge_links.token` indexed.

### Missing / Suboptimal Indexes
- `reports`: Current index `(userId, period)`. `GET /reports` queries `WHERE userId = X ORDER BY period DESC`. Index `(userId, period DESC)` avoids in-memory sort.
- `reports`: Index `publicIdx` on `(isPublic, period)`. Unused by current routes. Drop unless global public feed planned.

## 3. Query Patterns & Risks

### Over-fetching (Critical)
- `GET /reports` executes `db.select().from(reports)`. Selects entire `payload` JSONB for every report. High memory usage. Slow.
- **Fix:** Select only metadata fields (`id`, `period`, `narrativeStatus`, `persona`, `isPublic`, `createdAt`).

### Data Consistency
- `POST /reports/generate` uses `delete` then `insert` without transaction. Race condition risk.
- **Fix:** Wrap in `db.transaction()` or use `.onConflictDoUpdate()`.

### N+1 Risks
- None found in current routes. Architecture flat.

## 4. Storage & Scalability

### Report Storage
- `reports.payload` (JSONB) can grow large. Over-fetching (above) is main risk.
- `focusScore` stored as text. Bad for future aggregations or ranking.
- **Fix:** Use `numeric(5,2)` or `real` for `focusScore`.

### User & Retention Storage
- `users.deletedAt` used for soft deletes. Missing background job for hard deletion (GDPR risk).
- `challenge_links.expiresAt` exists. Missing cleanup job for expired rows.
- `sessions.expire` handles auth expiry, but needs `connect-pg-simple` cleanup cron.
