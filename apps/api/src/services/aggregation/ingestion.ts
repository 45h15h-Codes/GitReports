/**
 * GitHub data ingestion service
 *
 * Orchestrates GitHub API calls for a single user's monthly report.
 * Returns RepoIngestionData[] ready for the aggregation engine.
 *
 * Design decisions:
 * - Contributor stats are used for line counts when available (accurate, 1 call/repo)
 * - Falls back to sampling commit detail endpoints (up to 20 commits/repo)
 * - Repos with < 1 commit in period are filtered early to save rate limit budget
 * - Private repos are included only if the token has the `repo` scope
 * - Max repos processed: 50 (configurable) to prevent runaway API usage
 *
 * Rate limit strategy:
 * - Contributor stats: 1 call/repo → fast but async (202 retry needed)
 * - Commit listing: 1-5 pages/repo depending on volume
 * - PR listing: 1-3 pages/repo (closed PRs only)
 * - Sampling: up to 20 commit detail calls/repo
 * Total budget: ~200-250 API calls for a typical 10-repo month
 */

import {
  fetchUserRepos,
  fetchRepoCommits,
  fetchContributorStats,
  fetchRepoPullRequests,
  fetchCommitDetail,
  GitHubRateLimitError,
} from '../github/client';
import type { GitHubRepo } from '../github/types';
import { periodToDates } from './engine';
import type { RepoIngestionData } from './engine';

const MAX_REPOS_TO_PROCESS = 50;
const MAX_COMMIT_SAMPLE    = 20;   // commit detail calls per repo
const STATS_RETRY_ATTEMPTS = 3;
const STATS_RETRY_DELAY_MS = 2000;

// ── Stats retry helper ────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch contributor stats with retry for GitHub's async 202 response.
 * Returns null if still not ready after all retries.
 */
async function fetchStatsWithRetry(
  token:   string,
  owner:   string,
  repo:    string,
  retries: number = STATS_RETRY_ATTEMPTS,
) {
  for (let i = 0; i < retries; i++) {
    const stats = await fetchContributorStats(token, owner, repo);
    if (stats !== null) return stats;
    if (i < retries - 1) await sleep(STATS_RETRY_DELAY_MS);
  }
  return null;
}

/**
 * Extract lines_added and lines_deleted for a specific user from
 * the contributor stats for the given period.
 */
function extractLinesFromStats(
  stats:    Awaited<ReturnType<typeof fetchContributorStats>>,
  username: string,
  since:    string,
  until:    string,
): { linesAdded: number; linesDeleted: number } | null {
  if (!stats) return null;

  const sinceTs = new Date(since).getTime() / 1000;
  const untilTs = new Date(until).getTime() / 1000;

  const contributor = stats.find(
    s => s.author?.login.toLowerCase() === username.toLowerCase()
  );
  if (!contributor) return null;

  let linesAdded = 0;
  let linesDeleted = 0;

  for (const week of contributor.weeks) {
    if (week.w >= sinceTs && week.w <= untilTs) {
      linesAdded   += week.a;
      linesDeleted += week.d;
    }
  }

  return { linesAdded, linesDeleted };
}

// ── PR filtering ──────────────────────────────────────────────────────────────

/**
 * Filter PRs to those merged by the user within the period.
 * Only counts PRs where the user is the PR author (not just any merged PR).
 */
function countMergedPrs(
  prs:      Awaited<ReturnType<typeof fetchRepoPullRequests>>,
  username: string,
  since:    string,
  until:    string,
): number {
  const sinceDate = new Date(since);
  const untilDate = new Date(until);

  return prs.filter(pr => {
    if (!pr.merged_at) return false;
    if (pr.user.login.toLowerCase() !== username.toLowerCase()) return false;
    const mergedAt = new Date(pr.merged_at);
    return mergedAt >= sinceDate && mergedAt <= untilDate;
  }).length;
}

// ── Commit line-count sampling ────────────────────────────────────────────────

/**
 * Sample up to MAX_COMMIT_SAMPLE commits from a repo to estimate line changes.
 * Used as fallback when contributor stats are unavailable.
 *
 * Selects commits evenly distributed across the sorted commit list.
 */
async function sampleCommitLineChanges(
  token:   string,
  owner:   string,
  repo:    string,
  shas:    string[],
): Promise<{ linesAdded: number; linesDeleted: number; changeTotals: number[] }> {
  if (shas.length === 0) return { linesAdded: 0, linesDeleted: 0, changeTotals: [] };

  // Evenly sample commits
  const step = Math.max(1, Math.floor(shas.length / MAX_COMMIT_SAMPLE));
  const sampled = shas.filter((_, i) => i % step === 0).slice(0, MAX_COMMIT_SAMPLE);

  let totalAdded   = 0;
  let totalDeleted = 0;
  const changeTotals: number[] = [];

  for (const sha of sampled) {
    try {
      const detail = await fetchCommitDetail(token, owner, repo, sha);
      const adds = detail.stats?.additions ?? 0;
      const dels = detail.stats?.deletions  ?? 0;
      changeTotals.push(adds + dels);
      totalAdded   += adds;
      totalDeleted += dels;
    } catch {
      // If a single commit detail fails, skip it — don't fail the whole report
    }
  }

  // Scale up from sampled subset to full commit count
  if (sampled.length > 0 && sampled.length < shas.length) {
    const scale = shas.length / sampled.length;
    totalAdded   = Math.round(totalAdded   * scale);
    totalDeleted = Math.round(totalDeleted * scale);
  }

  return { linesAdded: totalAdded, linesDeleted: totalDeleted, changeTotals };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main ingestion orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

export interface IngestionOptions {
  /** Include private repos? Requires `repo` scope on the token. */
  includePrivate?: boolean;
  /** Max repos to process (sorted by most recently pushed) */
  maxRepos?:       number;
}

export interface IngestionResult {
  repos:        RepoIngestionData[];
  rateLimitHit: boolean;
  /** Unix ms timestamp when the rate limit resets (if hit) */
  rateLimitReset?: number;
  /** Repos skipped due to rate limit */
  reposSkipped: number;
}

/**
 * Ingest all GitHub data needed for a monthly aggregation report.
 * Called by the report generation worker/route.
 */
export async function ingestMonthlyData(
  token:    string,
  username: string,
  period:   string,
  opts:     IngestionOptions = {},
): Promise<IngestionResult> {
  const { includePrivate = false, maxRepos = MAX_REPOS_TO_PROCESS } = opts;
  const { since, until } = periodToDates(period);

  // Step 1: Fetch the user's repos
  let allRepos: GitHubRepo[] = [];
  try {
    allRepos = await fetchUserRepos(token);
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      return { repos: [], rateLimitHit: true, rateLimitReset: err.resetAt.getTime(), reposSkipped: 0 };
    }
    throw err;
  }

  // Filter: skip forks (user didn't create them), apply privacy filter, sort
  const targetRepos = allRepos
    .filter(r => !r.fork)
    .filter(r => includePrivate || !r.private)
    .slice(0, maxRepos);

  const repoResults: RepoIngestionData[] = [];
  let reposSkipped = 0;

  for (const repo of targetRepos) {
    const owner = repo.owner.login;
    const repoName = repo.name;
    const isUserOwned = owner.toLowerCase() === username.toLowerCase();

    try {
      // Step 2: Fetch commits for this repo in the period
      const commits = await fetchRepoCommits(
        token, owner, repoName, username, since, until,
      );

      // Skip repos with no activity in the period
      if (commits.length === 0) continue;

      // Step 3: Get line counts from contributor stats (preferred)
      let linesAdded   = 0;
      let linesDeleted = 0;
      let changeTotals: number[] = [];

      const stats = await fetchStatsWithRetry(token, owner, repoName);
      const lineData = extractLinesFromStats(stats, username, since, until);

      if (lineData) {
        linesAdded   = lineData.linesAdded;
        linesDeleted = lineData.linesDeleted;
        // For changeTotals, still sample to get distribution for size classifier
        const shas = commits.map(c => c.sha);
        const sampled = await sampleCommitLineChanges(token, owner, repoName, shas);
        changeTotals = sampled.changeTotals;
      } else {
        // Fallback: sample commit details for line counts
        const shas = commits.map(c => c.sha);
        const sampled = await sampleCommitLineChanges(token, owner, repoName, shas);
        linesAdded   = sampled.linesAdded;
        linesDeleted = sampled.linesDeleted;
        changeTotals = sampled.changeTotals;
      }

      // Step 4: Fetch merged PRs
      const prs = await fetchRepoPullRequests(token, owner, repoName, 'closed');
      const mergedPrs = countMergedPrs(prs, username, since, until);

      repoResults.push({
        repo,
        commits,
        commitChangeTotals: changeTotals,
        linesAdded,
        linesDeleted,
        mergedPrs,
        isUserOwned,
      });

    } catch (err) {
      if (err instanceof GitHubRateLimitError) {
        // Stop processing, return what we have so far
        reposSkipped = targetRepos.length - repoResults.length - 1;
        return {
          repos: repoResults,
          rateLimitHit:   true,
          rateLimitReset: err.resetAt.getTime(),
          reposSkipped,
        };
      }
      // Other errors: log and skip this repo — don't fail the whole report
      console.warn(`[ingestion] Skipping repo ${repo.full_name}: ${(err as Error).message}`);
      reposSkipped++;
    }
  }

  return { repos: repoResults, rateLimitHit: false, reposSkipped };
}
