import { motion }              from 'framer-motion'
import type { AchievementResponse } from '../lib/api'

const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_report:           '⚡',
  century_commits:        '💯',
  double_century_commits: '🚀',
  streak_week:            '🔥',
  streak_fortnight:       '🔥',
  streak_month:           '🏔️',
  polyglot:               '🌐',
  focused:                '🎯',
  open_source_month:      '🌍',
  comeback:               '📈',
}

interface AchievementBadgeProps {
  achievement: AchievementResponse
  isNew?:      boolean
  size?:       'sm' | 'md'
}

export function AchievementBadge({
  achievement,
  isNew  = false,
  size   = 'md',
}: AchievementBadgeProps) {
  const icon = ACHIEVEMENT_ICONS[achievement.achievementId] ?? '🏅'
  const isSm = size === 'sm'

  return (
    <motion.div
      initial={isNew ? { scale: 0, rotate: -12 } : false}
      animate={isNew ? { scale: 1, rotate: 0 }  : false}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
      className="flex flex-col items-center gap-2 text-center"
      title={achievement.description}
    >
      {/* Icon circle */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width:      isSm ? 40 : 56,
          height:     isSm ? 40 : 56,
          background: isNew ? '#1F3450' : '#161B22',
          border:     `1px solid ${isNew ? '#58A6FF55' : '#21262D'}`,
          fontSize:   isSm ? 18 : 24,
          position:   'relative',
        }}
      >
        {icon}
        {isNew && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
            style={{ background: '#3FB950', border: '2px solid #0D1117' }}
          />
        )}
      </div>

      {/* Label */}
      <div>
        <div
          className="font-mono font-medium"
          style={{
            fontSize: isSm ? 10 : 11,
            color:    isNew ? '#E6EDF3' : '#8B949E',
          }}
        >
          {achievement.title}
        </div>
        {!isSm && (
          <div className="font-mono text-[10px]" style={{ color: '#484F58' }}>
            {achievement.period}
          </div>
        )}
      </div>
    </motion.div>
  )
}
