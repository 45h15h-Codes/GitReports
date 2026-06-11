import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Medal, Star } from 'lucide-react'
import { api } from '../lib/api'
import { AchievementBadge } from '../components/AchievementBadge'
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

gsap.registerPlugin(useGSAP)

export function AchievementsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn:  () => api.getAchievements(),
  })

  const earned    = data?.achievements ?? []
  const earnedIds = new Set(earned.map((a: AchievementResponse) => a.achievementId))
  const total     = ACHIEVEMENT_DEFINITIONS.length

  useGSAP(() => {
    gsap.from('.gsap-animate', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'all'
    })
  }, { scope: containerRef, dependencies: [earned.length, isLoading] })

  return (
    <div ref={containerRef} className="flex flex-col gap-8 p-6 md:p-12 min-h-screen bg-[#090909] text-white selection:bg-[#0099ff] selection:text-white">
      {/* Header */}
      <div className="gsap-animate flex items-end justify-between flex-wrap gap-6 border-b border-white/5 pb-8">
        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-medium text-[#888888] uppercase tracking-[0.2em]">
            Milestones
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-none text-white">
            Achievements
          </h1>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <Trophy size={16} className="text-[#ffb800]" />
          <span className="text-[13px] font-medium text-white">
            {earned.length} <span className="text-[#888888]">/ {total} Unlocked</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="gsap-animate w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
        <div
          className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.round((earned.length / total) * 100)}%` }}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="gsap-animate h-32 rounded-3xl bg-[#141414] animate-pulse shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ACHIEVEMENT_DEFINITIONS.map(def => {
            const isEarned  = earnedIds.has(def.id)
            const earnedRow = earned.find((a: AchievementResponse) => a.achievementId === def.id)

            return (
              <div
                key={def.id}
                className="gsap-animate group rounded-[24px] p-6 flex items-start gap-4 transition-all duration-300"
                style={{
                  background: isEarned ? '#141414' : '#0a0a0a',
                  boxShadow:  isEarned 
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px -8px rgba(0,0,0,0.5)' 
                    : 'inset 0 0 0 1px rgba(255,255,255,0.03)',
                  opacity:    isEarned ? 1 : 0.6,
                }}
              >
                {isEarned && earnedRow ? (
                  <div className="shrink-0 transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <AchievementBadge achievement={earnedRow} size="sm" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-[#111111] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                    <Medal size={20} className="text-[#444444]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className={`text-[15px] font-semibold tracking-tight ${isEarned ? 'text-white' : 'text-[#888888]'}`}>
                    {def.title}
                  </div>
                  <div className="text-[13px] text-[#888888] leading-snug">
                    {ACHIEVEMENT_DESCRIPTIONS[def.id] ?? ''}
                  </div>
                  {earnedRow && (
                    <div className="text-[11px] font-medium text-[#666666] mt-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Star size={10} className="text-[#ffb800]" />
                      Unlocked {new Date(earnedRow.unlockedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
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
