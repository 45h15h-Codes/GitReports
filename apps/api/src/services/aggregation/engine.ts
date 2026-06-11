/**
 * Core aggregation engine (PRD §3.1, §7.2)
 *
 * Transforms raw GitHub API data into the structured AI payload.
 * This module runs ENTIRELY server-side. No raw GitHub data reaches the client.
 *
 * Pipeline:
 *   GitHub API data
 *     → Per-repo commit + line + PR aggregation
 *     → Streak computation (longest + current)
 *     → Peak hour block computation
 *     → Commit size distribution
 *     → Focus score (0.0–1.0)
 *     → category_signal classification per repo
 *     → Persona derivation
 *     → Language breakdown (% of total lines)
 *     → Payload assembly
 *
 * Privacy rules (PRD §9.1):
 *   - Repo names are SHA-256 hashed before entering the payload
 *   - No commit messages, file names, branch names, or code content
 *   - Private repo data only appears in the owner's dashboard payload
 */

import crypto from 'crypto';
import type { GitHubRepo, GitHubCommitListItem, GitHubPullRequest, GitHubContributorStat } from '../github/types';
import {
  classifyRepo,
  computeAvgSizeBucket,
  computeCommitSizeDist,
} from './classifier';
import { derivePersona } from './persona';
import {
  PAYLOAD_VERSION,
  type AiPayload,
  type RepoAggregate,
  type PeakHourBlock,
  type CommitSizeDist,
  type PrevPeriodSummary,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-256 hash of repo full_name — real names never reach LLM (PRD §3.3) */
function hashRepoName(fullName: string): string {
  return crypto.createHash('sha256').update(fullName).digest('hex').slice(0, 16);
}

/** Parse ISO-8601 date string → calendar date string 'YYYY-MM-DD' */
function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

/** Parse 'YYYY-MM' period into [startDate, endDate] ISO-8601 strings */
export function periodToDates(period: string): { since: string; until: string } {
  if (period.length === 4) {
    const year = parseInt(period, 10);
    return {
      since: new Date(year, 0, 1).toISOString(),
      until: new Date(year, 11, 31, 23, 59, 59).toISOString(),
    };
  }

  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month! - 1, 1);
  const end   = new Date(year, month!, 0, 23, 59, 59); // last day of month
  return {
    since: start.toISOString(),
    until: end.toISOString(),
  };
}

/**
 * Compute peak_hour_block from an array of commit ISO-8601 timestamps.
 * Bucketed to avoid leaking exact commit times (PRD §3.3):
 *   morning    05:00–11:59
 *   afternoon  12:00–16:59
 *   evening    17:00–21:59
 *   night      22:00–04:59
 */
function computePeakHourBlock(commitDates: string[]): PeakHourBlock {
  const hourCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  for (const dateStr of commitDates) {
    const hour = new Date(dateStr).getHours();
    if (hour >= 5 && hour < 12)       hourCounts.morning++;
    else if (hour >= 12 && hour < 17) hourCounts.afternoon++;
    else if (hour >= 17 && hour < 22) hourCounts.evening++;
    else                              hourCounts.night++;
  }

  let peak: PeakHourBlock = 'evening';
  let max = 0;
  for (const [block, count] of Object.entries(hourCounts)) {
    if (count > max) { max = count; peak = block as PeakHourBlock; }
  }
  return peak;
}

/**
 * Compute longest streak and current streak (as of the period end) from
 * a set of active day strings ('YYYY-MM-DD').
 *
 * "Current streak" = consecutive days ending on or before the last active day
 * in the period. For the most recent completed month this is the streak at
 * the period's end — not today's live streak.
 */
function computeStreaks(activeDays: Set<string>): {
  longest: number;
  current: number;
} {
  if (activeDays.size === 0) return { longest: 0, current: 0 };

  const sorted = Array.from(activeDays).sort();
  let longest = 1;
  let runLen  = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 1) {
      runLen++;
      if (runLen > longest) longest = runLen;
    } else {
      runLen = 1;
    }
  }

  // Current streak = run ending at the last active day
  let current = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 1) current++;
    else break;
  }

  return { longest, current };
}

/**
 * Compute focus score (0.0–1.0) from repo commit distribution.
 *
 * Focus score = Herfindahl-Hirschman Index of commit share across repos.
 * HHI = Σ (share_i²) where share_i = commits_in_repo_i / total_commits
 *
 * 1.0 = all commits in one repo (maximum focus)
 * 0.0 = infinitely distributed (maximum scatter — theoretical minimum)
 *
 * This gives a more meaningful score than simple max-share because it
 * accounts for the full distribution, matching PRD's narrative intent.
 */
function computeFocusScore(repos: Array<{ commits: number }>): number {
  const total = repos.reduce((sum, r) => sum + r.commits, 0);
  if (total === 0) return 0;
  const hhi = repos.reduce((sum, r) => {
    const share = r.commits / total;
    return sum + share * share;
  }, 0);
  // Round to 2 decimal places
  return Math.round(hhi * 100) / 100;
}

/**
 * Build the language breakdown as percentage of total lines added.
 * Returns a Record<language, percentage> rounded to integer %.
 * Repos with null language are excluded.
 */
function buildLanguageBreakdown(
  repos: Array<{ language: string | null; lines_added: number }>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  let grandTotal = 0;

  for (const r of repos) {
    if (!r.language) continue;
    totals[r.language] = (totals[r.language] ?? 0) + r.lines_added;
    grandTotal += r.lines_added;
  }

  if (grandTotal === 0) return {};

  const breakdown: Record<string, number> = {};
  for (const [lang, lines] of Object.entries(totals)) {
    breakdown[lang] = Math.round((lines / grandTotal) * 100);
  }
  return breakdown;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main aggregation entry point
// ═══════════════════════════════════════════════════════════════════════════════

export interface RepoIngestionData {
  repo:             GitHubRepo;
  /** Commits authored by the user in the period */
  commits:          GitHubCommitListItem[];
  /** Per-commit line change totals (additions + deletions) — sampled or full */
  commitChangeTotals: number[];
  /** lines_added total for the period (from contributor stats or sampled detail) */
  linesAdded:       number;
  /** lines_deleted total for the period */
  linesDeleted:     number;
  /** Pull requests merged by the user in the period */
  mergedPrs:        number;
  /** Whether the authenticated user owns this repo (owner.login === username) */
  isUserOwned:      boolean;
}

export interface AggregationInput {
  username:          string;
  period:            string;   // 'YYYY-MM'
  repos:             RepoIngestionData[];
  prevPeriodSummary: PrevPeriodSummary | null;
}

/**
 * Run the full aggregation pipeline and return the structured AI payload.
 * This is the primary export of the aggregation engine.
 */
export function aggregateMonthlyData(input: AggregationInput): AiPayload {
  const { username, period, repos, prevPeriodSummary } = input;

  // Collect all commit timestamps for streak + peak hour computation
  const allCommitDates: string[] = [];
  const activeDays = new Set<string>();
  const allChangeTotals: number[] = [];

  // Build per-repo aggregates
  const repoAggregates: RepoAggregate[] = [];

  for (const rd of repos) {
    // Skip repos with zero commits in the period
    if (rd.commits.length === 0) continue;

    // Collect timestamps
    for (const commit of rd.commits) {
      const date = commit.commit.author.date;
      allCommitDates.push(date);
      activeDays.add(toDateStr(date));
    }

    // Change totals for size distribution
    allChangeTotals.push(...rd.commitChangeTotals);

    const avgSizeBucket = computeAvgSizeBucket(rd.commitChangeTotals);

    // Detect if this is an open source contribution (public, not user-owned)
    const isOpenSourceContrib = !rd.repo.private && !rd.isUserOwned;

    const signal = classifyRepo({
      language:        rd.repo.language,
      is_public:       !rd.repo.private,
      is_user_owned:   rd.isUserOwned,
      commits:         rd.commits.length,
      lines_added:     rd.linesAdded,
      lines_deleted:   rd.linesDeleted,
      prs_merged:      rd.mergedPrs,
      avg_size_bucket: avgSizeBucket,
    });

    repoAggregates.push({
      name_hash:       hashRepoName(rd.repo.full_name),
      is_public:       !rd.repo.private,
      language:        rd.repo.language,
      commits:         rd.commits.length,
      lines_added:     rd.linesAdded,
      lines_deleted:   rd.linesDeleted,
      prs_merged:      rd.mergedPrs,
      category_signal: signal,
    });
  }

  // Global metrics
  const totalCommits    = repoAggregates.reduce((s, r) => s + r.commits, 0);
  const linesAddedTotal = repoAggregates.reduce((s, r) => s + r.lines_added, 0);
  const prsMergedTotal  = repoAggregates.reduce((s, r) => s + r.prs_merged, 0);
  const reposTouched    = repoAggregates.length;

  const { longest, current } = computeStreaks(activeDays);
  const peakHourBlock   = computePeakHourBlock(allCommitDates);
  const commitSizeDist  = computeCommitSizeDist(allChangeTotals);
  const focusScore      = computeFocusScore(repoAggregates);
  const persona         = derivePersona(repoAggregates);
  const languages       = buildLanguageBreakdown(repoAggregates);

  // Build daily_commits array for the month/year
  let dailyCommits: number[];
  
  if (period.length === 4) {
    // Yearly report: Group commits into 12 monthly buckets
    dailyCommits = new Array(12).fill(0);
    for (const dateStr of allCommitDates) {
      const commitMonth = parseInt(dateStr.slice(5, 7), 10);
      if (commitMonth >= 1 && commitMonth <= 12) {
        dailyCommits[commitMonth - 1]++;
      }
    }
  } else {
    // Monthly report: Group commits into daily buckets
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    dailyCommits = new Array(daysInMonth).fill(0);
    for (const dateStr of allCommitDates) {
      const day = parseInt(dateStr.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) {
        dailyCommits[day - 1]++;
      }
    }
  }

  return {
    payload_version:     PAYLOAD_VERSION,
    period,
    total_commits:       totalCommits,
    active_days:         activeDays.size,
    longest_streak:      longest,
    current_streak:      current,
    repos:               repoAggregates,
    languages,
    peak_hour_block:     peakHourBlock,
    commit_size_dist:    commitSizeDist,
    focus_score:         focusScore,
    developer_persona:   persona,
    lines_added_total:   linesAddedTotal,
    prs_merged_total:    prsMergedTotal,
    repos_touched:       reposTouched,
    daily_commits:       dailyCommits,
    prev_period_summary: prevPeriodSummary,
  };
}
