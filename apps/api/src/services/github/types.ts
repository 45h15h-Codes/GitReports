/**
 * GitHub REST API response types
 * Used only server-side — never serialised back to client JS.
 *
 * References:
 *   https://docs.github.com/en/rest/repos/repos
 *   https://docs.github.com/en/rest/commits/commits
 *   https://docs.github.com/en/rest/pulls/pulls
 */

// ── Repository ────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  id:            number;
  name:          string;
  full_name:     string;
  private:       boolean;
  fork:          boolean;         // true → not the user's original work
  language:      string | null;
  stargazers_count: number;
  pushed_at:     string | null;   // ISO-8601
  created_at:    string;
  updated_at:    string;
  owner: {
    login: string;
    id:    number;
  };
}

// ── Commits ───────────────────────────────────────────────────────────────────

export interface GitHubCommit {
  sha:    string;
  commit: {
    message: string;            // NOT forwarded to LLM — privacy rule
    author: {
      name:  string | null;
      email: string | null;
      date:  string;            // ISO-8601
    };
  };
  stats?: {                     // only present when fetching single commit detail
    additions: number;
    deletions: number;
    total:     number;
  };
  author: { login: string } | null;
}

/** Compact shape returned by the /repos/:owner/:repo/commits list endpoint */
export interface GitHubCommitListItem {
  sha: string;
  commit: {
    author: {
      date: string;             // ISO-8601
    };
  };
  author: { login: string } | null;
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

export interface GitHubPullRequest {
  id:         number;
  number:     number;
  state:      'open' | 'closed';
  merged_at:  string | null;    // ISO-8601, null if not merged
  created_at: string;
  user: {
    login: string;
    id:    number;
  };
  base: {
    repo: {
      full_name: string;
      private:   boolean;
      owner: { login: string };
    };
  };
}

// ── Stats — contributor stats ─────────────────────────────────────────────────

export interface GitHubWeekStat {
  w:  number;   // Unix timestamp (start of week)
  a:  number;   // additions
  d:  number;   // deletions
  c:  number;   // commits
}

export interface GitHubContributorStat {
  author: { login: string; id: number } | null;
  total:  number;
  weeks:  GitHubWeekStat[];
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data:        T[];
  hasNextPage: boolean;
  nextPage:    number | null;
}
