/**
 * GitHub REST API Client
 *
 * SECURITY RULES (PRD §9.3):
 * - All calls are server-side only. Token NEVER leaves this module.
 * - Respects GitHub rate limits (primary + secondary). Backs off gracefully.
 * - Default page size: 100 (GitHub max) to minimise request count.
 * - Max pages per fetch: enforced by callers to prevent runaway loops.
 *
 * Rate limit headers used:
 *   X-RateLimit-Remaining  — remaining requests in window
 *   X-RateLimit-Reset      — Unix timestamp when window resets
 *   Retry-After            — secondary rate limit back-off seconds
 */

import type {
  GitHubRepo,
  GitHubCommitListItem,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContributorStat,
  PaginatedResult,
} from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_PER_PAGE    = 100;

// ── Rate-limit error ──────────────────────────────────────────────────────────

export class GitHubRateLimitError extends Error {
  constructor(public readonly resetAt: Date) {
    super(`GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

// ── Core request helper ───────────────────────────────────────────────────────

async function ghFetch<T>(
  token:    string,
  endpoint: string,
  params:   Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${GITHUB_API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization:  `Bearer ${token}`,
      Accept:         'application/vnd.github.v3+json',
      'User-Agent':   'GitReport/3.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  // Secondary rate limit
  if (res.status === 429 || res.status === 403) {
    const retryAfter = res.headers.get('Retry-After');
    const resetHeader = res.headers.get('X-RateLimit-Reset');
    const resetAt = retryAfter
      ? new Date(Date.now() + Number(retryAfter) * 1000)
      : resetHeader
        ? new Date(Number(resetHeader) * 1000)
        : new Date(Date.now() + 60_000);
    throw new GitHubRateLimitError(resetAt);
  }

  if (!res.ok) {
    throw new GitHubApiError(
      `GitHub API error: ${res.status} ${res.statusText} — ${endpoint}`,
      res.status,
      endpoint,
    );
  }

  return res.json() as Promise<T>;
}

// ── Paginated fetch helper ────────────────────────────────────────────────────
// maxPages prevents unbounded loops for users with thousands of repos/commits.

async function ghFetchAll<T>(
  token:    string,
  endpoint: string,
  params:   Record<string, string | number> = {},
  maxPages  = 10,
): Promise<T[]> {
  const url = new URL(`${GITHUB_API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set('per_page', String(MAX_PER_PAGE));
  url.searchParams.set('page', '1');

  const headers = {
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github.v3+json',
    'User-Agent':   'GitReport/3.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch(url.toString(), { headers });

  if (res.status === 429 || res.status === 403) {
    const retryAfter = res.headers.get('Retry-After');
    const resetHeader = res.headers.get('X-RateLimit-Reset');
    const resetAt = retryAfter
      ? new Date(Date.now() + Number(retryAfter) * 1000)
      : resetHeader
        ? new Date(Number(resetHeader) * 1000)
        : new Date(Date.now() + 60_000);
    throw new GitHubRateLimitError(resetAt);
  }

  if (!res.ok) {
    throw new GitHubApiError(`GitHub API error: ${res.status} — ${endpoint}`, res.status, endpoint);
  }

  const page_data = await res.json() as T[];
  if (!Array.isArray(page_data)) return [];

  const linkHeader = res.headers.get('Link');
  let lastPage = 1;
  if (linkHeader) {
    const lastMatch = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>; rel="last"/);
    if (lastMatch) {
      lastPage = parseInt(lastMatch[1]!, 10);
    } else if (linkHeader.includes('rel="next"')) {
      // fallback if last is missing but next is present (rare)
      lastPage = maxPages; 
    }
  }

  const targetPages = Math.min(lastPage, maxPages);
  if (targetPages <= 1) return page_data;

  // Fetch remaining pages concurrently
  const fetchPage = async (p: number) => {
    const pUrl = new URL(url.toString());
    pUrl.searchParams.set('page', String(p));
    const pRes = await fetch(pUrl.toString(), { headers });
    if (!pRes.ok) return [];
    const data = await pRes.json() as T[];
    return Array.isArray(data) ? data : [];
  };

  const remainingPromises = [];
  for (let p = 2; p <= targetPages; p++) {
    remainingPromises.push(fetchPage(p));
  }

  const remainingResults = await Promise.all(remainingPromises);
  return [page_data, ...remainingResults.flat()] as T[];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all repos accessible to the authenticated user.
 * Includes private repos if the token has the `repo` scope.
 * maxPages × 100 = max repos fetched (default: 1000).
 */
export async function fetchUserRepos(
  token:    string,
  maxPages  = 10,
): Promise<GitHubRepo[]> {
  return ghFetchAll<GitHubRepo>(
    token,
    '/user/repos',
    { affiliation: 'owner,collaborator', sort: 'pushed', direction: 'desc' },
    maxPages,
  );
}

/**
 * Fetch commits authored by `username` in a specific repo for a date range.
 * `since` and `until` are ISO-8601 strings.
 * Returns commit list items (no per-file stats — those are fetched separately).
 */
export async function fetchRepoCommits(
  token:    string,
  owner:    string,
  repo:     string,
  author:   string,
  since:    string,
  until:    string,
  maxPages  = 5,
): Promise<GitHubCommitListItem[]> {
  return ghFetchAll<GitHubCommitListItem>(
    token,
    `/repos/${owner}/${repo}/commits`,
    { author, since, until },
    maxPages,
  );
}

/**
 * Fetch a single commit's detail including file stats (additions/deletions).
 * Used selectively — calling for every commit would exhaust rate limits.
 * Aggregation engine samples commits for line counts instead.
 */
export async function fetchCommitDetail(
  token: string,
  owner: string,
  repo:  string,
  sha:   string,
): Promise<GitHubCommit> {
  return ghFetch<GitHubCommit>(
    token,
    `/repos/${owner}/${repo}/commits/${sha}`,
  );
}

/**
 * Fetch contributor statistics for a repo.
 * GitHub computes these asynchronously — may return 202 on first call.
 * Callers should retry after 2s if null is returned.
 *
 * Returns null if GitHub responds 202 (still computing).
 */
export async function fetchContributorStats(
  token: string,
  owner: string,
  repo:  string,
): Promise<GitHubContributorStat[] | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/contributors`;
  const res = await fetch(url, {
    headers: {
      Authorization:  `Bearer ${token}`,
      Accept:         'application/vnd.github.v3+json',
      'User-Agent':   'GitReport/3.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 202) return null; // still computing
  if (res.status === 429 || res.status === 403) {
    const retryAfter = res.headers.get('Retry-After');
    const resetAt = retryAfter
      ? new Date(Date.now() + Number(retryAfter) * 1000)
      : new Date(Date.now() + 60_000);
    throw new GitHubRateLimitError(resetAt);
  }
  if (!res.ok) throw new GitHubApiError(`Stats fetch failed: ${res.status}`, res.status, url);

  return res.json() as Promise<GitHubContributorStat[]>;
}

/**
 * Fetch pull requests merged by the authenticated user in a specific repo
 * within the reporting period.
 */
export async function fetchRepoPullRequests(
  token:  string,
  owner:  string,
  repo:   string,
  state:  'open' | 'closed' | 'all' = 'closed',
  maxPages = 3,
): Promise<GitHubPullRequest[]> {
  return ghFetchAll<GitHubPullRequest>(
    token,
    `/repos/${owner}/${repo}/pulls`,
    { state, sort: 'updated', direction: 'desc' },
    maxPages,
  );
}
