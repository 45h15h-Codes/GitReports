/**
 * AI Payload types — the contract between the aggregation engine and the LLM.
 *
 * This schema is the most important engineering decision in v3.0 (PRD §3.2).
 * It governs privacy, token cost, output quality, and longitudinal comparison.
 *
 * VERSIONING: increment PAYLOAD_VERSION when the schema changes.
 * Historical payload reads must never break — use optional fields for additions.
 */

export const PAYLOAD_VERSION = 1;

// ── category_signal per repo ──────────────────────────────────────────────────

export type CategorySignal =
  | 'high_churn_refactor'
  | 'feature_build'
  | 'maintenance'
  | 'exploratory'
  | 'open_source_contrib'
  | 'documentation'
  | 'unknown';

// ── Developer persona ─────────────────────────────────────────────────────────

export type DeveloperPersona =
  | 'The Architect'
  | 'The Shipper'
  | 'The Maintainer'
  | 'The Explorer'
  | 'The Open Source Contributor'
  | 'The Builder';

// ── Peak activity hour block ──────────────────────────────────────────────────
// Bucketed to avoid leaking exact timestamps (PRD §3.3)

export type PeakHourBlock = 'morning' | 'afternoon' | 'evening' | 'night';

// ── Commit size distribution ──────────────────────────────────────────────────
// tiny:   1–5 lines changed
// small:  6–30 lines
// medium: 31–150 lines
// large:  151+ lines

export interface CommitSizeDist {
  tiny:   number;
  small:  number;
  medium: number;
  large:  number;
}

// ── Per-repo aggregation ──────────────────────────────────────────────────────

export interface RepoAggregate {
  /** SHA-256 hash of full_name — real repo names never reach LLM (PRD §3.3) */
  name_hash:      string;
  is_public:      boolean;
  language:       string | null;
  commits:        number;
  lines_added:    number;
  lines_deleted:  number;
  prs_merged:     number;
  /** Deterministic classification computed before LLM call (PRD §3.4) */
  category_signal: CategorySignal;
}

// ── Previous period summary ───────────────────────────────────────────────────
// Enables longitudinal narrative (PRD §6.1).

export interface PrevPeriodSummary {
  total_commits:     number;
  focus_score:       number;
  dominant_language: string | null;
  persona:           DeveloperPersona;
}

// ── Full AI Payload ───────────────────────────────────────────────────────────

export interface AiPayload {
  /** Schema version — increment on breaking changes */
  payload_version:   number;
  /** Calendar month: 'YYYY-MM' */
  period:            string;

  // ── Volume metrics ──────────────────────────────────────────────────────────
  total_commits:     number;
  active_days:       number;
  longest_streak:    number;
  current_streak:    number;

  // ── Per-repo breakdown ──────────────────────────────────────────────────────
  repos:             RepoAggregate[];

  // ── Language distribution (percentage of total lines) ──────────────────────
  languages:         Record<string, number>;

  // ── Behavioural signals ─────────────────────────────────────────────────────
  peak_hour_block:   PeakHourBlock;
  commit_size_dist:  CommitSizeDist;

  // ── Derived intelligence ────────────────────────────────────────────────────
  /** 0.0–1.0: concentration of work in a single repo (higher = more focused) */
  focus_score:       number;
  /** Deterministic from category_signal distribution — LLM reads, never sets */
  developer_persona: DeveloperPersona;

  // ── Derived totals computed by aggregation engine ───────────────────────────
  lines_added_total: number;
  prs_merged_total:  number;
  repos_touched:     number;
  daily_commits:     number[];

  // ── Longitudinal context ────────────────────────────────────────────────────
  /** Null on first-ever report */
  prev_period_summary: PrevPeriodSummary | null;
}
