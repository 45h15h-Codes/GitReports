import type { AiPayload } from '../aggregation/types'

export interface AchievementDefinition {
  id:          string
  title:       string
  description: string
  /** Returns meta object if earned, null if not */
  evaluate:    (payload: AiPayload, reportCount: number) => Record<string, unknown> | null
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id:          'first_report',
    title:       'Origin Story',
    description: 'Generated your first GitReport.',
    evaluate: (_payload, reportCount) =>
      reportCount === 1 ? {} : null,
  },
  {
    id:          'century_commits',
    title:       'Century',
    description: 'Shipped 100+ commits in a single month.',
    evaluate: (p) =>
      p.total_commits >= 100
        ? { commits: p.total_commits }
        : null,
  },
  {
    id:          'double_century_commits',
    title:       'Double Century',
    description: 'Shipped 200+ commits in a single month.',
    evaluate: (p) =>
      p.total_commits >= 200
        ? { commits: p.total_commits }
        : null,
  },
  {
    id:          'streak_week',
    title:       'Week Warrior',
    description: 'Maintained a 7-day commit streak.',
    evaluate: (p) =>
      p.longest_streak >= 7
        ? { streak: p.longest_streak }
        : null,
  },
  {
    id:          'streak_fortnight',
    title:       'Fortnight',
    description: 'Maintained a 14-day commit streak.',
    evaluate: (p) =>
      p.longest_streak >= 14
        ? { streak: p.longest_streak }
        : null,
  },
  {
    id:          'streak_month',
    title:       'The Long Game',
    description: 'Committed every single day for a full month (28+ days).',
    evaluate: (p) =>
      p.longest_streak >= 28
        ? { streak: p.longest_streak }
        : null,
  },
  {
    id:          'polyglot',
    title:       'Polyglot',
    description: 'Used 4 or more programming languages in a single month.',
    evaluate: (p) => {
      const count = Object.keys(p.languages).length
      return count >= 4 ? { languages: count } : null
    },
  },
  {
    id:          'focused',
    title:       'Deep Work',
    description: 'Achieved a focus score above 80% — near-total concentration on one project.',
    evaluate: (p) =>
      p.focus_score >= 0.8
        ? { focus_score: Math.round(p.focus_score * 100) }
        : null,
  },
  {
    id:          'open_source_month',
    title:       'Open Source Month',
    description: 'All active repos this month were public.',
    evaluate: (p) => {
      const activeRepos = p.repos.filter(r => r.commits > 0)
      if (activeRepos.length === 0) return null
      return activeRepos.every(r => r.is_public)
        ? { repos: activeRepos.length }
        : null
    },
  },
  {
    id:          'comeback',
    title:       'Comeback',
    description: 'Shipped 50%+ more commits than the previous month.',
    evaluate: (p) => {
      if (!p.prev_period_summary) return null
      const prev = p.prev_period_summary.total_commits
      if (prev === 0) return null
      const growth = (p.total_commits - prev) / prev
      return growth >= 0.5
        ? { growth_pct: Math.round(growth * 100), prev_commits: prev }
        : null
    },
  },
]
