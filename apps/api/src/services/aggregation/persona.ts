/**
 * Developer persona derivation (PRD §3.5)
 *
 * The persona is computed DETERMINISTICALLY on the server from the
 * distribution of category_signal values across all repos in the period.
 * The LLM does NOT choose the persona — it only uses it in the narrative.
 *
 * Persona rules (PRD §3.5):
 * ┌─────────────────────────┬────────────────────────────────────────────────────┐
 * │ Persona                 │ Derivation rule                                    │
 * ├─────────────────────────┼────────────────────────────────────────────────────┤
 * │ The Architect           │ >50% of total commits in high_churn_refactor repos │
 * │ The Shipper             │ Majority in feature_build (high PR + output rate)  │
 * │ The Maintainer          │ Majority in maintenance (steady, low drama)        │
 * │ The Explorer            │ Majority in exploratory (wide spread, small repos) │
 * │ The Open Source Contr.  │ Majority in open_source_contrib                   │
 * │ The Builder             │ Balanced mix — no dominant signal                  │
 * └─────────────────────────┴────────────────────────────────────────────────────┘
 */

import type { CategorySignal, DeveloperPersona, RepoAggregate } from './types';

/**
 * Derive the developer's persona for the period from the repo list.
 * Uses commit-weighted signal distribution (not repo count) so that
 * large repos drive the classification, not many tiny repos.
 */
export function derivePersona(repos: RepoAggregate[]): DeveloperPersona {
  const totalCommits = repos.reduce((sum, r) => sum + r.commits, 0);
  if (totalCommits === 0) return 'The Builder'; // fallback for empty period

  // Accumulate commit-weighted signal distribution
  const signalCommits: Record<CategorySignal, number> = {
    high_churn_refactor:  0,
    feature_build:         0,
    maintenance:           0,
    exploratory:           0,
    open_source_contrib:   0,
    documentation:         0,
    unknown:               0,
  };

  for (const repo of repos) {
    signalCommits[repo.category_signal] += repo.commits;
  }

  // Compute percentages
  const pct = (signal: CategorySignal): number =>
    signalCommits[signal] / totalCommits;

  const MAJORITY = 0.5; // >50% = dominant signal

  if (pct('high_churn_refactor') > MAJORITY)  return 'The Architect';
  if (pct('feature_build') > MAJORITY)         return 'The Shipper';
  if (pct('maintenance') > MAJORITY)           return 'The Maintainer';
  if (pct('exploratory') > MAJORITY)           return 'The Explorer';
  if (pct('open_source_contrib') > MAJORITY)   return 'The Open Source Contributor';

  // No majority signal — find the dominant pair (feature_build + exploratory = Builder)
  // The Builder: balanced mix, no single signal >50%
  return 'The Builder';
}

/**
 * Persona color system (PRD §4.3)
 * Used for Dev Card badge coloring.
 */
export const PERSONA_COLORS: Record<DeveloperPersona, string> = {
  'The Architect':              '#185FA5',
  'The Shipper':                '#3FB950',
  'The Maintainer':             '#888780',
  'The Explorer':               '#E3B341',
  'The Open Source Contributor': '#BC8CFF',
  'The Builder':                '#D85A30',
};
