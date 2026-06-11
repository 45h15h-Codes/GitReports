import { useEffect, useState }   from 'react'
import { Trophy, Medal }               from 'lucide-react'
import { api }                   from '../lib/api'
import type { AchievementResponse } from '../lib/api'
import { AchievementBadge }      from './AchievementBadge'
import { ACHIEVEMENT_DEFINITIONS } from '../lib/achievementDefs'

export function AchievementsPanel() {
  const [earned,    setEarned   ] = useState<AchievementResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.getAchievements()
      .then(res => setEarned((res as { achievements: AchievementResponse[] }).achievements))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const totalDefined = ACHIEVEMENT_DEFINITIONS.length
  const earnedIds    = new Set(earned.map(a => a.achievementId))

  return (
    <div
      className="rounded-[2rem] p-5 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-widest"
          style={{ color: '#484F58', letterSpacing: '0.08em' }}
        >
          Achievements
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy size={13} color="#E3B341" strokeWidth={2.5} />
          <span className="font-mono text-[11px]" style={{ color: '#8B949E' }}>
            {earned.length}/{totalDefined}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton w-10 h-10 rounded-full mx-auto" />
          ))}
        </div>
      ) : (
        <>
          {/* Earned */}
          {earned.length > 0 && (
            <div className="grid grid-cols-5 gap-4 mb-5">
              {earned.map(a => (
                <AchievementBadge key={a.achievementId} achievement={a} size="sm" />
              ))}
            </div>
          )}

          {/* Locked — show title only, greyed out */}
          {earned.length < totalDefined && (
            <>
              {earned.length > 0 && (
                <div
                  style={{ height: 1, background: '#21262D', margin: '0 0 16px' }}
                />
              )}
              <div className="grid grid-cols-5 gap-4">
                {ACHIEVEMENT_DEFINITIONS
                  .filter(def => !earnedIds.has(def.id))
                  .map(def => (
                    <div
                      key={def.id}
                      className="flex flex-col items-center gap-2 text-center"
                      title={def.title}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-lg"
                        style={{
                          width:      40,
                          height:     40,
                          background: '#0D1117',
                          border:     '1px solid #21262D',
                          fontSize:   16,
                          opacity:    0.35,
                          filter:     'grayscale(1)',
                        }}
                      >
                        <Medal size={20} color="#6B7280" strokeWidth={2} />
                      </div>
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: '#30363D' }}
                      >
                        {def.title}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
