/**
 * API type definitions — single source of truth for all frontend types.
 *
 * These mirror the backend AiPayload / assembler shapes.
 * mockPayload.ts types have been migrated here (Sprint 9).
 */

// ── Shared enums ──────────────────────────────────────────────────────────────

export type CategorySignal =
  | 'high_churn_refactor'
  | 'feature_build'
  | 'maintenance'
  | 'exploratory'
  | 'open_source_contrib'
  | 'documentation'
  | 'unknown'

export type DeveloperPersona =
  | 'The Architect'
  | 'The Shipper'
  | 'The Maintainer'
  | 'The Explorer'
  | 'The Open Source Contributor'
  | 'The Builder'

export type PeakHourBlock = 'morning' | 'afternoon' | 'evening' | 'night'

export type NarrativeStatus = 'pending' | 'generating' | 'complete' | 'failed'

// ── Repo aggregate ────────────────────────────────────────────────────────────

export interface RepoAggregate {
  name_hash:       string
  is_public:       boolean
  language:        string | null
  commits:         number
  lines_added:     number
  lines_deleted:   number
  prs_merged:      number
  category_signal: CategorySignal
}

// ── Previous period summary ───────────────────────────────────────────────────

export interface PrevPeriodSummary {
  total_commits:     number
  focus_score:       number
  dominant_language: string | null
  persona:           DeveloperPersona
}

// ── Commit size distribution ──────────────────────────────────────────────────

export interface CommitSizeDist {
  tiny:   number
  small:  number
  medium: number
  large:  number
}

// ── AI Payload — mirrors backend AiPayload ────────────────────────────────────
// NOTE: `ai_summary` / `narrative` lives at the report level, not payload.
// Components that need narrative must read from MonthlyReport.narrative.

export interface AiPayload {
  payload_version:     number
  period:              string
  total_commits:       number
  active_days:         number
  longest_streak:      number
  current_streak:      number
  repos:               RepoAggregate[]
  languages:           Record<string, number>
  peak_hour_block:     PeakHourBlock
  commit_size_dist:    CommitSizeDist
  focus_score:         number
  developer_persona:   DeveloperPersona
  prev_period_summary: PrevPeriodSummary | null
  // Derived totals computed by aggregation engine
  lines_added_total:   number
  prs_merged_total:    number
  repos_touched:       number
  daily_commits:       number[]
}

// ── Full owner report — returned by GET /reports/:period ──────────────────────

export interface MonthlyReport {
  id:              number
  period:          string
  payloadVersion:  number
  payload:         AiPayload
  narrative:       string | null   // LLM-generated summary, null until complete
  narrativeStatus: NarrativeStatus
  persona:         string | null
  focusScore:      string | null
  isPublic:        boolean
  generatedAt:     string
  updatedAt:       string
}

// ── Public report — returned by GET /public/u/:username/:period ───────────────

export interface PublicReport {
  period:          string
  payloadVersion:  number
  payload:         AiPayload      // private repos already stripped server-side
  narrative:       string | null
  narrativeStatus: NarrativeStatus
  persona:         string | null
  focusScore:      string | null
  generatedAt:     string
}

// ── Report list item — returned by GET /reports ───────────────────────────────

export interface ReportListItem {
  id:              number
  period:          string
  persona:         string | null
  focusScore:      string | null
  narrativeStatus: NarrativeStatus
  isPublic:        boolean
  generatedAt:     string
}

// ── Narrative status poll — GET /reports/:period/status ───────────────────────

export interface NarrativeStatusResponse {
  narrativeStatus: NarrativeStatus
  narrative?:      string  // present only when status === 'complete'
}

// ── Auth user — returned by GET /auth/me ──────────────────────────────────────

export interface AuthUser {
  id:          number
  username:    string
  displayName: string | null
  avatarUrl:   string | null
  tokenScope:  string
  createdAt:   string
}

// ── Developer profile — shape consumed by ProfileCard ───────────────
// Alias for convenience; sourced from AuthUser fields.

export interface DeveloperProfile {
  username:     string
  avatar_url:   string | null
  display_name: string | null
}

// ── Generate report response — POST /reports/generate ────────────────────────

export interface GenerateReportResponse {
  report:          MonthlyReport
  cached:          boolean
  rateLimitHit?:   boolean
  reposProcessed?: number
  reposSkipped?:   number
}

// ── Reports list response — GET /reports ─────────────────────────────────────

export interface ReportsListResponse {
  reports: ReportListItem[]
}

// ── Public report response — GET /public/u/:username/:period ─────────────────

export interface PublicReportResponse {
  user: {
    username:    string
    displayName: string | null
    avatarUrl:   string | null
  }
  report: PublicReport
}
