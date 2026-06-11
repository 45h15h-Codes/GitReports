import { useQuery }                from '@tanstack/react-query'
import { Trophy }                  from '@phosphor-icons/react'
import { api }                     from '../lib/api'
import { AchievementBadge }        from '../components/AchievementBadge'
import { ACHIEVEMENT_DEFINITIONS } from '../lib/achievementDefs'
import type { AchievementResponse } from '../lib/api'

const ACHIEVEMENT_DESCRIPTIONS: Record<string, string> = {
  first_report:           'Generated your first GitReport.',
  century_commits:        'Shipped 100+ commits in a single month.',
  double_century_commits: 'Shipped 200+ commits in a single month.',
  streak_week:            'Maintained a 7-day commit streak.',
  streak_fortnight:       'Maintained a 14-day commit streak.',
  streak_month:           'Committed every single day for a full month (28+ days).',
  polyglot:               'Used 4 or more programming languages in a single month.',
  focused:                'Achieved a focus score above 80%.',
  open_source_month:      'All active repos this month were public.',
  comeback:               'Shipped 50%+ more commits than the previous month.',
}

export function AchievementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn:  () => api.getAchievements(),
  })

  const earned    = data?.achievements ?? []
  const earnedIds = new Set(earned.map((a: AchievementResponse) => a.achievementId))
  const total     = ACHIEVEMENT_DEFINITIONS.length

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: '#0D1117' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div
            className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
            style={{ color: '#484F58', letterSpacing: '0.1em' }}
          >
            Milestones
          </div>
          <h1
            className="font-display font-bold text-[28px] leading-tight"
            style={{ color: '#E6EDF3' }}
          >
            Achievements
          </h1>
        </div>
        <div
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: '#161B22', border: '1px solid #21262D' }}
        >
          <Trophy size={14} weight="duotone" color="#E3B341" />
          <span className="font-mono text-[12px]" style={{ color: '#8B949E' }}>
            {earned.length}/{total} unlocked
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ height: 4, background: '#21262D' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width:      `${Math.round((earned.length / total) * 100)}%`,
            background: '#E3B341',
          }}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACHIEVEMENT_DEFINITIONS.map(def => {
            const isEarned  = earnedIds.has(def.id)
            const earnedRow = earned.find((a: AchievementResponse) => a.achievementId === def.id)

            return (
              <div
                key={def.id}
                className="rounded-xl p-5 flex items-start gap-4"
                style={{
                  background: isEarned ? '#161B22' : '#0D1117',
                  border:     `1px solid ${isEarned ? '#21262D' : '#161B22'}`,
                  opacity:    isEarned ? 1 : 0.5,
                }}
              >
                {isEarned && earnedRow ? (
                  <AchievementBadge achievement={earnedRow} size="sm" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: '#1C2128',
                      border:     '1px solid #21262D',
                      fontSize:   18,
                      filter:     'grayscale(1)',
                    }}
                  >
                    🏅
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div
                    className="font-mono text-[13px] font-medium mb-1"
                    style={{ color: isEarned ? '#E6EDF3' : '#484F58' }}
                  >
                    {def.title}
                  </div>
                  <div
                    className="font-mono text-[11px] leading-relaxed"
                    style={{ color: '#8B949E' }}
                  >
                    {ACHIEVEMENT_DESCRIPTIONS[def.id] ?? ''}
                  </div>
                  {earnedRow && (
                    <div
                      className="font-mono text-[10px] mt-1.5"
                      style={{ color: '#484F58' }}
                    >
                      Unlocked {new Date(earnedRow.unlockedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })} · {earnedRow.period}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
