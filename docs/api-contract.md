# GitReport API Contract

**Base URL:** `http://localhost:3001` (dev) · `https://api.gitreport.app` (prod)  
**Auth:** Session cookie (`connect.sid`, HttpOnly, Secure, 30-day TTL)  
**Content-Type:** `application/json`

---

## Authentication

### `GET /auth/github`
Redirect to GitHub OAuth. Full page navigation (not fetch).

**Response:** `302` → GitHub OAuth page

---

### `GET /auth/github/callback`
OAuth callback. Sets session cookie, redirects to frontend.

**Response:** `302` → `FRONTEND_URL/` (success) or `FRONTEND_URL/login?auth_error=denied`

---

### `GET /auth/me`
Returns authenticated user profile.

**Auth required:** Yes

**Response `200`:**
```json
{
  "user": {
    "id": 1,
    "username": "ashish",
    "displayName": "Ashish K",
    "avatarUrl": "https://avatars.githubusercontent.com/u/123",
    "tokenScope": "public_repo",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response `401`:** Not authenticated
```json
{ "error": "Unauthorized" }
```

---

### `POST /auth/logout`
Destroy session.

**Auth required:** Yes  
**Response:** `204 No Content`

---

## Reports

### `GET /reports`
List all report metadata for authenticated user. Excludes payload + narrative.

**Auth required:** Yes

**Response `200`:**
```json
{
  "reports": [
    {
      "id": 42,
      "period": "2024-12",
      "persona": "The Shipper",
      "focusScore": "0.82",
      "narrativeStatus": "complete",
      "isPublic": true,
      "generatedAt": "2024-12-31T23:00:00.000Z"
    }
  ]
}
```

---

### `GET /reports/:period`
Full report for authenticated user. Period format: `YYYY-MM`.

**Auth required:** Yes

**Response `200`:**
```json
{
  "report": {
    "id": 42,
    "period": "2024-12",
    "payloadVersion": 1,
    "payload": { /* AiPayload — see types */ },
    "narrative": "This month you shipped...",
    "narrativeStatus": "complete",
    "persona": "The Shipper",
    "focusScore": "0.82",
    "isPublic": true,
    "generatedAt": "2024-12-31T23:00:00.000Z",
    "updatedAt": "2024-12-31T23:05:00.000Z"
  }
}
```

**Response `404`:** Report not generated for this period
```json
{ "error": "Report not found" }
```

---

### `GET /reports/:period/status`
Lightweight status poll. Used during narrative generation.

**Auth required:** Yes

**Response `200`:**
```json
{
  "narrativeStatus": "generating"
}
```

When complete:
```json
{
  "narrativeStatus": "complete",
  "narrative": "This month you shipped..."
}
```

**Possible values:** `pending` | `generating` | `complete` | `failed`

---

### `POST /reports/generate`
Trigger GitHub ingestion + narrative generation pipeline.

**Auth required:** Yes

**Request body (optional):**
```json
{ "period": "2024-12" }
```
Defaults to previous calendar month if omitted.

**Response `201`:**
```json
{
  "report": {
    "id": 42,
    "period": "2024-12",
    "narrativeStatus": "pending",
    /* ... full MonthlyReport shape ... */
  },
  "cached": false,
  "reposProcessed": 12,
  "reposSkipped": 3
}
```

**Response `200`:** (when report already exists and `cached: true`)

**Response `429`:** Rate limit hit
```json
{ "error": "Rate limit exceeded", "retryAfter": 3600 }
```

**Notes:**
- Returns immediately — ingestion is synchronous but narrative (BullMQ worker) is async.
- `narrativeStatus` will be `pending` until worker completes.
- Poll `GET /reports/:period/status` at 2s interval until `complete` or `failed`.
- Recommended timeout: 30 seconds.

---

## Public Surfaces

All public endpoints: no auth required, read-only, private repos absent from payload.

### `GET /public/u/:username/:period`
Public report for a user's given period. Private repos stripped server-side (PRD §9.2).

**Response `200`:**
```json
{
  "user": {
    "username": "ashish",
    "displayName": "Ashish K",
    "avatarUrl": "https://avatars.githubusercontent.com/u/123"
  },
  "report": {
    "period": "2024-12",
    "payloadVersion": 1,
    "payload": {
      "repos": [ /* only is_public === true repos */ ]
      /* ... other AiPayload fields ... */
    },
    "narrative": "This month you shipped...",
    "narrativeStatus": "complete",
    "persona": "The Shipper",
    "focusScore": "0.82",
    "generatedAt": "2024-12-31T23:00:00.000Z"
  }
}
```

**Response `404`:** User not found or report not public
```json
{ "error": "Report not found" }
```

---

## Payload Types

### `AiPayload`
```ts
interface AiPayload {
  payload_version:     number       // schema version
  period:              string       // 'YYYY-MM'
  total_commits:       number
  active_days:         number
  longest_streak:      number
  current_streak:      number
  repos:               RepoAggregate[]
  languages:           Record<string, number>   // lang → % of total lines
  peak_hour_block:     'morning' | 'afternoon' | 'evening' | 'night'
  commit_size_dist:    { tiny: number; small: number; medium: number; large: number }
  focus_score:         number       // 0.0–1.0
  developer_persona:   DeveloperPersona
  prev_period_summary: PrevPeriodSummary | null
  lines_added_total:   number
  prs_merged_total:    number
  repos_touched:       number
  daily_commits:       number[]     // length = days in month
}
```

### `RepoAggregate`
```ts
interface RepoAggregate {
  name_hash:       string          // SHA-256 of full_name — repo names never sent
  is_public:       boolean
  language:        string | null
  commits:         number
  lines_added:     number
  lines_deleted:   number
  prs_merged:      number
  category_signal: CategorySignal
}
```

### `DeveloperPersona`
```
'The Architect' | 'The Shipper' | 'The Maintainer' |
'The Explorer' | 'The Open Source Contributor' | 'The Builder'
```

---

## Error Format

All errors return:
```json
{ "error": "Human-readable message" }
```

Standard codes: `400` Bad Request · `401` Unauthorized · `404` Not Found · `429` Rate Limited · `500` Server Error
