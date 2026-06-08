/**
 * category_signal classifier (PRD §3.4)
 *
 * Deterministic repo-level classification of work pattern.
 * The server computes this BEFORE any LLM call.
 * The AI interprets pre-classified signals — not raw numbers.
 *
 * Classification rules (from PRD §3.4):
 * ┌─────────────────────┬──────────────────────────────────────────────────────┐
 * │ Signal              │ Detection criteria                                   │
 * ├─────────────────────┼──────────────────────────────────────────────────────┤
 * │ high_churn_refactor │ lines_deleted/lines_added > 0.6 AND commits > 20    │
 * │ feature_build       │ prs_merged >= 3 AND lines_added > 1000              │
 * │                     │   AND churn_ratio < 0.4                             │
 * │ maintenance         │ commits > 10 AND avg_commit_size === 'tiny'         │
 * │                     │   AND prs_merged <= 1                               │
 * │ exploratory         │ commits < 10 AND lines_added < 300                  │
 * │ open_source_contrib │ is_public === true AND prs_merged >= 2              │
 * │                     │   AND repo is NOT user-owned                        │
 * │ documentation       │ language === 'Markdown'|'MDX'                        │
 * │                     │   OR (lines_added > 500 AND code_lines < 100)       │
 * └─────────────────────┴──────────────────────────────────────────────────────┘
 *
 * Rules are evaluated in priority order — first match wins.
 */

import type { CategorySignal } from './types';

export interface RepoClassifierInput {
  language:      string | null;
  is_public:     boolean;
  is_user_owned: boolean;       // false → fork or contributor repo
  commits:       number;
  lines_added:   number;
  lines_deleted: number;
  prs_merged:    number;
  /** average commit size bucket — computed by size classifier */
  avg_size_bucket: 'tiny' | 'small' | 'medium' | 'large';
  /** code-only lines added (excludes Markdown/docs) — optional, defaults to lines_added */
  code_lines_added?: number;
}

/**
 * Classify a single repo's work pattern for the reporting period.
 * Returns the highest-priority matching signal.
 */
export function classifyRepo(input: RepoClassifierInput): CategorySignal {
  const {
    language,
    is_public,
    is_user_owned,
    commits,
    lines_added,
    lines_deleted,
    prs_merged,
    avg_size_bucket,
    code_lines_added,
  } = input;

  const churnRatio = lines_added > 0 ? lines_deleted / lines_added : 0;
  const codeLinesAdded = code_lines_added ?? lines_added;

  // 1. Documentation — check language first (fastest exit)
  if (
    language === 'Markdown' ||
    language === 'MDX' ||
    (lines_added > 500 && codeLinesAdded < 100)
  ) {
    return 'documentation';
  }

  // 2. Open source contribution — must be public AND not user-owned repo
  if (is_public && !is_user_owned && prs_merged >= 2) {
    return 'open_source_contrib';
  }

  // 3. High-churn refactor — heavy deletions relative to additions
  if (churnRatio > 0.6 && commits > 20) {
    return 'high_churn_refactor';
  }

  // 4. Feature build — PRs + volume + low churn
  if (prs_merged >= 3 && lines_added > 1000 && churnRatio < 0.4) {
    return 'feature_build';
  }

  // 5. Maintenance — many small commits, low PR activity
  if (commits > 10 && avg_size_bucket === 'tiny' && prs_merged <= 1) {
    return 'maintenance';
  }

  // 6. Exploratory — low commit count + low lines
  if (commits < 10 && lines_added < 300) {
    return 'exploratory';
  }

  // Fallback — some activity but doesn't fit neatly
  return 'unknown';
}

/**
 * Compute the average commit size bucket for a set of commit line-change totals.
 * Used as input to the repo classifier.
 *
 * Size buckets (PRD §3.2):
 *   tiny:   1–5 lines changed
 *   small:  6–30 lines
 *   medium: 31–150 lines
 *   large:  151+ lines
 */
export function computeAvgSizeBucket(
  changeTotals: number[],
): 'tiny' | 'small' | 'medium' | 'large' {
  if (changeTotals.length === 0) return 'tiny';
  const avg = changeTotals.reduce((a, b) => a + b, 0) / changeTotals.length;
  if (avg <= 5)   return 'tiny';
  if (avg <= 30)  return 'small';
  if (avg <= 150) return 'medium';
  return 'large';
}

/**
 * Compute the full CommitSizeDist histogram from a list of per-commit change totals.
 */
export function computeCommitSizeDist(changeTotals: number[]): {
  tiny:   number;
  small:  number;
  medium: number;
  large:  number;
} {
  const dist = { tiny: 0, small: 0, medium: 0, large: 0 };
  for (const total of changeTotals) {
    if (total <= 5)   dist.tiny++;
    else if (total <= 30)  dist.small++;
    else if (total <= 150) dist.medium++;
    else                   dist.large++;
  }
  return dist;
}
