/**
 * ActivityMeta — 3-cell grid showing active days, longest streak, current streak.
 * Extracted from Dashboard.tsx inline JSX — Sprint D.5.
 */

interface ActivityMetaProps {
  activeDays:    number
  longestStreak: number
  currentStreak: number
}

export function ActivityMeta({ activeDays, longestStreak, currentStreak }: ActivityMetaProps) {
  const items = [
    { label: 'Active Days',    value: activeDays,    suffix: 'd' },
    { label: 'Longest Streak', value: longestStreak, suffix: 'd' },
    { label: 'Current Streak', value: currentStreak, suffix: 'd' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(item => (
        <div
          key={item.label}
          className="rounded-xl p-4 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="font-display font-bold text-[2rem]"
            style={{ color: 'var(--text-primary)', lineHeight: 1 }}
          >
            {item.value}
            <span className="font-mono text-[14px]" style={{ color: 'var(--text-muted)', marginLeft: 2 }}>
              {item.suffix}
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}
