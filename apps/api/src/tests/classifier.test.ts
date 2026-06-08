/**
 * Unit tests: category_signal classifier (PRD §3.4)
 *
 * Covers all 6 signal types + 'unknown' fallback.
 * Each rule is tested with exact-boundary conditions to catch
 * off-by-one errors in the thresholds.
 */

import { describe, it, expect } from 'vitest';
import { classifyRepo, computeAvgSizeBucket, computeCommitSizeDist } from '../services/aggregation/classifier';
import type { RepoClassifierInput } from '../services/aggregation/classifier';

// ── classifyRepo ──────────────────────────────────────────────────────────────

describe('classifyRepo', () => {
  const base: RepoClassifierInput = {
    language:        'TypeScript',
    is_public:       false,
    is_user_owned:   true,
    commits:         25,
    lines_added:     2000,
    lines_deleted:   300,
    prs_merged:      5,
    avg_size_bucket: 'medium',
  };

  it('returns "documentation" for Markdown language (highest priority)', () => {
    expect(classifyRepo({ ...base, language: 'Markdown' })).toBe('documentation');
    expect(classifyRepo({ ...base, language: 'MDX' })).toBe('documentation');
  });

  it('returns "documentation" when lines_added > 500 and code_lines_added < 100', () => {
    expect(
      classifyRepo({ ...base, language: 'TypeScript', lines_added: 600, code_lines_added: 50 }),
    ).toBe('documentation');
  });

  it('does NOT return "documentation" when code_lines_added >= 100', () => {
    const result = classifyRepo({
      ...base,
      language:         'TypeScript',
      lines_added:      600,
      code_lines_added: 100,
    });
    expect(result).not.toBe('documentation');
  });

  it('returns "open_source_contrib" for public non-owned repos with >= 2 PRs', () => {
    expect(
      classifyRepo({ ...base, is_public: true, is_user_owned: false, prs_merged: 2 }),
    ).toBe('open_source_contrib');
  });

  it('does NOT return "open_source_contrib" for user-owned repos', () => {
    const result = classifyRepo({ ...base, is_public: true, is_user_owned: true, prs_merged: 5 });
    expect(result).not.toBe('open_source_contrib');
  });

  it('does NOT return "open_source_contrib" for private repos', () => {
    const result = classifyRepo({ ...base, is_public: false, is_user_owned: false, prs_merged: 5 });
    expect(result).not.toBe('open_source_contrib');
  });

  it('returns "high_churn_refactor" when deletion ratio > 0.6 and commits > 20', () => {
    expect(
      classifyRepo({ ...base, lines_added: 1000, lines_deleted: 700, commits: 21 }),
    ).toBe('high_churn_refactor');
  });

  it('does NOT return "high_churn_refactor" when commits <= 20', () => {
    const result = classifyRepo({
      ...base,
      lines_added: 1000,
      lines_deleted: 700,
      commits: 20,
    });
    expect(result).not.toBe('high_churn_refactor');
  });

  it('returns "feature_build" for prs_merged >= 3, lines_added > 1000, churn < 0.4', () => {
    expect(
      classifyRepo({ ...base, prs_merged: 3, lines_added: 1001, lines_deleted: 399 }),
    ).toBe('feature_build');
  });

  it('does NOT return "feature_build" when churn ratio >= 0.4', () => {
    // lines_deleted / lines_added = 400 / 1000 = 0.4 exactly — NOT < 0.4, so rule should NOT fire
    const result = classifyRepo({ ...base, prs_merged: 3, lines_added: 1000, lines_deleted: 400 });
    expect(result).not.toBe('feature_build');
  });

  it('returns "maintenance" for commits > 10, tiny avg size, prs_merged <= 1', () => {
    expect(
      classifyRepo({ ...base, commits: 15, avg_size_bucket: 'tiny', prs_merged: 0 }),
    ).toBe('maintenance');
  });

  it('returns "exploratory" for commits < 10 and lines_added < 300', () => {
    expect(
      classifyRepo({ ...base, commits: 5, lines_added: 100, prs_merged: 0 }),
    ).toBe('exploratory');
  });

  it('returns "unknown" for activity that does not match any rule', () => {
    // 12 commits, medium size, 2 PRs, moderate lines — no rule fires
    expect(
      classifyRepo({
        ...base,
        commits:     12,
        lines_added: 500,
        lines_deleted: 100,
        prs_merged:  2,
        avg_size_bucket: 'medium',
      }),
    ).toBe('unknown');
  });
});

// ── computeAvgSizeBucket ──────────────────────────────────────────────────────

describe('computeAvgSizeBucket', () => {
  it('returns "tiny" for empty array', () => {
    expect(computeAvgSizeBucket([])).toBe('tiny');
  });

  it('returns "tiny" when avg <= 5', () => {
    expect(computeAvgSizeBucket([1, 2, 3, 5])).toBe('tiny');   // avg = 2.75
    expect(computeAvgSizeBucket([5, 5])).toBe('tiny');           // avg = 5
  });

  it('returns "small" when avg is 6–30', () => {
    expect(computeAvgSizeBucket([6, 30])).toBe('small');          // avg = 18
    expect(computeAvgSizeBucket([30])).toBe('small');             // avg = 30
  });

  it('returns "medium" when avg is 31–150', () => {
    expect(computeAvgSizeBucket([31, 150])).toBe('medium');       // avg = 90.5
    expect(computeAvgSizeBucket([150])).toBe('medium');           // avg = 150
  });

  it('returns "large" when avg > 150', () => {
    expect(computeAvgSizeBucket([151])).toBe('large');
    expect(computeAvgSizeBucket([500, 1000])).toBe('large');
  });
});

// ── computeCommitSizeDist ─────────────────────────────────────────────────────

describe('computeCommitSizeDist', () => {
  it('returns zeroed dist for empty array', () => {
    expect(computeCommitSizeDist([])).toEqual({ tiny: 0, small: 0, medium: 0, large: 0 });
  });

  it('correctly buckets a mixed set', () => {
    const dist = computeCommitSizeDist([1, 5, 6, 30, 31, 150, 151, 1000]);
    expect(dist).toEqual({ tiny: 2, small: 2, medium: 2, large: 2 });
  });

  it('handles exact boundary values (5 → tiny, 6 → small, 30 → small, 31 → medium, 150 → medium, 151 → large)', () => {
    const dist = computeCommitSizeDist([5, 6, 30, 31, 150, 151]);
    expect(dist).toEqual({ tiny: 1, small: 2, medium: 2, large: 1 });
  });
});
