/**
 * Unit tests: aggregation engine — focus_score + full pipeline (PRD §3.1, §3.2)
 *
 * Tests:
 *   - computeFocusScore (via aggregateMonthlyData)
 *   - periodToDates helper
 *   - aggregateMonthlyData — end-to-end payload assembly
 *
 * No network calls, no DB — pure deterministic functions.
 */

import { describe, it, expect } from 'vitest';
import { aggregateMonthlyData, periodToDates } from '../services/aggregation/engine';
import type { AggregationInput, RepoIngestionData } from '../services/aggregation/engine';
import type { GitHubRepo, GitHubCommitListItem } from '../services/github/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCommit(date: string, authorLogin = 'testuser'): GitHubCommitListItem {
  return {
    sha: Math.random().toString(36).slice(2),
    commit: { author: { date } },
    author: { login: authorLogin },
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id:               1,
    name:             'test-repo',
    full_name:        'testuser/test-repo',
    private:          false,
    fork:             false,
    language:         'TypeScript',
    stargazers_count: 10,
    pushed_at:        '2025-04-30T00:00:00Z',
    created_at:       '2024-01-01T00:00:00Z',
    updated_at:       '2025-04-30T00:00:00Z',
    owner:            { login: 'testuser', id: 42 },
    ...overrides,
  };
}

function makeRepoIngestion(overrides: Partial<RepoIngestionData> = {}): RepoIngestionData {
  return {
    repo:               makeRepo(),
    commits:            [makeCommit('2025-04-10T18:30:00Z')],
    commitChangeTotals: [25],
    linesAdded:         500,
    linesDeleted:       100,
    mergedPrs:          2,
    isUserOwned:        true,
    ...overrides,
  };
}

const BASE_INPUT: AggregationInput = {
  username:          'testuser',
  period:            '2025-04',
  repos:             [makeRepoIngestion()],
  prevPeriodSummary: null,
};

// ── periodToDates ─────────────────────────────────────────────────────────────
// NOTE: periodToDates uses new Date(year, month-1, day) which creates LOCAL time dates.
// We test via Date.parse() → check local date components to avoid timezone flakiness.

function localDateStr(iso: string): string {
  const d = new Date(iso);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

describe('periodToDates', () => {
  it('returns the first and last day of the month', () => {
    const { since, until } = periodToDates('2025-04');
    expect(localDateStr(since)).toBe('2025-04-01');
    expect(localDateStr(until)).toBe('2025-04-30');
  });

  it('handles February correctly (non-leap year)', () => {
    const { since, until } = periodToDates('2025-02');
    expect(localDateStr(since)).toBe('2025-02-01');
    expect(localDateStr(until)).toBe('2025-02-28');
  });

  it('handles February in a leap year', () => {
    const { since, until } = periodToDates('2024-02');
    expect(localDateStr(since)).toBe('2024-02-01');
    expect(localDateStr(until)).toBe('2024-02-29');
  });

  it('handles December correctly', () => {
    const { since, until } = periodToDates('2025-12');
    expect(localDateStr(since)).toBe('2025-12-01');
    expect(localDateStr(until)).toBe('2025-12-31');
  });
});

// ── aggregateMonthlyData — payload shape ─────────────────────────────────────

describe('aggregateMonthlyData', () => {
  it('returns a valid AiPayload with all required fields', () => {
    const payload = aggregateMonthlyData(BASE_INPUT);

    expect(payload.payload_version).toBe(1);
    expect(payload.period).toBe('2025-04');
    expect(typeof payload.total_commits).toBe('number');
    expect(typeof payload.active_days).toBe('number');
    expect(typeof payload.longest_streak).toBe('number');
    expect(typeof payload.current_streak).toBe('number');
    expect(Array.isArray(payload.repos)).toBe(true);
    expect(typeof payload.focus_score).toBe('number');
    expect(typeof payload.developer_persona).toBe('string');
    expect(payload.peak_hour_block).toMatch(/^(morning|afternoon|evening|night)$/);
    expect(payload.prev_period_summary).toBeNull();
  });

  it('skips repos with zero commits', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [makeRepoIngestion({ commits: [] })],
    };
    const payload = aggregateMonthlyData(input);
    expect(payload.total_commits).toBe(0);
    expect(payload.repos).toHaveLength(0);
  });

  it('returns focus_score of 1.0 when all commits are in one repo', () => {
    const payload = aggregateMonthlyData(BASE_INPUT);
    // Single repo → all commits in one place → HHI = 1.0
    expect(payload.focus_score).toBe(1);
  });

  it('returns focus_score between 0 and 1 for multiple repos', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [
        makeRepoIngestion({
          repo: makeRepo({ full_name: 'testuser/repo-a' }),
          commits: [makeCommit('2025-04-05T10:00:00Z'), makeCommit('2025-04-06T10:00:00Z')],
        }),
        makeRepoIngestion({
          repo: makeRepo({ full_name: 'testuser/repo-b' }),
          commits: [makeCommit('2025-04-10T10:00:00Z')],
        }),
      ],
    };
    const payload = aggregateMonthlyData(input);
    expect(payload.focus_score).toBeGreaterThan(0);
    expect(payload.focus_score).toBeLessThan(1);
  });

  it('hashes repo names — no real name_hash matches the full_name', () => {
    const payload = aggregateMonthlyData(BASE_INPUT);
    for (const repo of payload.repos) {
      expect(repo.name_hash).not.toBe('testuser/test-repo');
      expect(repo.name_hash).toMatch(/^[a-f0-9]{16}$/);  // 16-char hex
    }
  });

  it('computes correct commit count', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [
        makeRepoIngestion({
          commits: [
            makeCommit('2025-04-01T09:00:00Z'),
            makeCommit('2025-04-02T09:00:00Z'),
            makeCommit('2025-04-03T09:00:00Z'),
          ],
        }),
      ],
    };
    expect(aggregateMonthlyData(input).total_commits).toBe(3);
  });

  it('counts active days correctly', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [
        makeRepoIngestion({
          commits: [
            makeCommit('2025-04-01T09:00:00Z'),
            makeCommit('2025-04-01T18:00:00Z'),  // same day — should count as 1
            makeCommit('2025-04-02T09:00:00Z'),
          ],
        }),
      ],
    };
    expect(aggregateMonthlyData(input).active_days).toBe(2);
  });

  it('computes longest streak correctly for consecutive days', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [
        makeRepoIngestion({
          commits: [
            makeCommit('2025-04-01T09:00:00Z'),
            makeCommit('2025-04-02T09:00:00Z'),
            makeCommit('2025-04-03T09:00:00Z'),
            makeCommit('2025-04-10T09:00:00Z'),  // break
          ],
        }),
      ],
    };
    expect(aggregateMonthlyData(input).longest_streak).toBe(3);
  });

  it('includes prev_period_summary when provided', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      prevPeriodSummary: {
        total_commits:     200,
        focus_score:       0.82,
        dominant_language: 'TypeScript',
        persona:           'The Architect',
      },
    };
    const payload = aggregateMonthlyData(input);
    expect(payload.prev_period_summary).not.toBeNull();
    expect(payload.prev_period_summary?.total_commits).toBe(200);
    expect(payload.prev_period_summary?.focus_score).toBe(0.82);
  });

  it('builds language breakdown as percentages summing to ~100', () => {
    const input: AggregationInput = {
      ...BASE_INPUT,
      repos: [
        makeRepoIngestion({
          repo: makeRepo({ language: 'TypeScript', full_name: 'testuser/ts-repo' }),
          linesAdded: 600,
        }),
        makeRepoIngestion({
          repo: makeRepo({ language: 'Python', full_name: 'testuser/py-repo' }),
          linesAdded: 400,
          commits: [makeCommit('2025-04-05T10:00:00Z')],
        }),
      ],
    };
    const payload = aggregateMonthlyData(input);
    const total = Object.values(payload.languages).reduce((a, b) => a + b, 0);
    // Rounding may cause sum to be 99 or 100
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
    expect(payload.languages['TypeScript']).toBeDefined();
    expect(payload.languages['Python']).toBeDefined();
  });
});
