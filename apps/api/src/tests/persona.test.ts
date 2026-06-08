/**
 * Unit tests: persona derivation (PRD §3.5)
 *
 * Covers all 6 persona types + The Builder (balanced/fallback).
 * Uses commit-weighted distribution — large repos dominate classification.
 */

import { describe, it, expect } from 'vitest';
import { derivePersona, PERSONA_COLORS } from '../services/aggregation/persona';
import type { RepoAggregate } from '../services/aggregation/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo(signal: RepoAggregate['category_signal'], commits: number): RepoAggregate {
  return {
    name_hash:       'abc123',
    is_public:       true,
    language:        'TypeScript',
    commits,
    lines_added:     1000,
    lines_deleted:   200,
    prs_merged:      3,
    category_signal: signal,
  };
}

// ── derivePersona ─────────────────────────────────────────────────────────────

describe('derivePersona', () => {
  it('returns "The Builder" for an empty repo list', () => {
    expect(derivePersona([])).toBe('The Builder');
  });

  it('returns "The Builder" when total commits = 0', () => {
    const repos = [makeRepo('feature_build', 0), makeRepo('exploratory', 0)];
    expect(derivePersona(repos)).toBe('The Builder');
  });

  it('returns "The Architect" when > 50% commits are in high_churn_refactor', () => {
    const repos = [
      makeRepo('high_churn_refactor', 60),
      makeRepo('feature_build', 40),
    ];
    expect(derivePersona(repos)).toBe('The Architect');
  });

  it('does NOT return "The Architect" when exactly 50% (not >)', () => {
    const repos = [
      makeRepo('high_churn_refactor', 50),
      makeRepo('feature_build', 50),
    ];
    // 50% is not > 50%, so no majority — falls through to "The Builder"
    expect(derivePersona(repos)).toBe('The Builder');
  });

  it('returns "The Shipper" when > 50% commits are in feature_build', () => {
    const repos = [
      makeRepo('feature_build', 80),
      makeRepo('maintenance', 20),
    ];
    expect(derivePersona(repos)).toBe('The Shipper');
  });

  it('returns "The Maintainer" when > 50% commits are in maintenance', () => {
    const repos = [
      makeRepo('maintenance', 70),
      makeRepo('exploratory', 30),
    ];
    expect(derivePersona(repos)).toBe('The Maintainer');
  });

  it('returns "The Explorer" when > 50% commits are in exploratory', () => {
    const repos = [
      makeRepo('exploratory', 100),
      makeRepo('documentation', 40),
    ];
    expect(derivePersona(repos)).toBe('The Explorer');
  });

  it('returns "The Open Source Contributor" when > 50% in open_source_contrib', () => {
    const repos = [
      makeRepo('open_source_contrib', 60),
      makeRepo('feature_build', 30),
    ];
    expect(derivePersona(repos)).toBe('The Open Source Contributor');
  });

  it('returns "The Builder" when no single signal > 50% (balanced mix)', () => {
    const repos = [
      makeRepo('feature_build',   30),
      makeRepo('exploratory',     30),
      makeRepo('maintenance',     25),
      makeRepo('documentation',   15),
    ];
    expect(derivePersona(repos)).toBe('The Builder');
  });

  it('is commit-weighted, not repo-count weighted', () => {
    // 10 tiny repos in exploratory (5 commits each = 50) vs 1 big feature_build (200 commits)
    const repos = [
      ...Array.from({ length: 10 }, () => makeRepo('exploratory', 5)),
      makeRepo('feature_build', 200),   // 200 / 250 = 80% → Shipper
    ];
    expect(derivePersona(repos)).toBe('The Shipper');
  });
});

// ── PERSONA_COLORS ────────────────────────────────────────────────────────────

describe('PERSONA_COLORS', () => {
  it('has a color for every persona', () => {
    const personas: Array<RepoAggregate['category_signal']> = [] as never[]; // just to reference the personas
    const expected = [
      'The Architect',
      'The Shipper',
      'The Maintainer',
      'The Explorer',
      'The Open Source Contributor',
      'The Builder',
    ] as const;

    for (const persona of expected) {
      expect(PERSONA_COLORS[persona]).toBeDefined();
      expect(PERSONA_COLORS[persona]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has exactly 6 persona colors (no extras)', () => {
    expect(Object.keys(PERSONA_COLORS)).toHaveLength(6);
  });
});
