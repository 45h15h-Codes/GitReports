import { motion } from 'framer-motion'
import { formatMonthShort, formatMonthYear } from '../utils/persona'

interface MonthSelectorProps {
  months:   string[]
  selected: string
  onSelect: (period: string) => void
}

export function MonthSelector({ months, selected, onSelect }: MonthSelectorProps) {
  const currentYear = new Date().getFullYear().toString()

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg"
      style={{ background: '#161B22', border: '1px solid #21262D' }}
      role="group"
      aria-label="Select reporting month"
    >
      {months.map((period) => {
        const isActive = period === selected
        const year     = formatMonthYear(period)
        const label    = formatMonthShort(period)

        return (
          <button
            key={period}
            onClick={() => onSelect(period)}
            aria-pressed={isActive}
            className="relative px-3 py-1.5 rounded-md font-mono text-[11px] font-medium cursor-pointer"
            style={{
              color:      isActive ? '#E6EDF3' : '#8B949E',
              background: 'transparent',
              border:     'none',
              outline:    'none',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="month-pill"
                className="absolute inset-0 rounded-md"
                style={{ background: '#1F3450' }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10">
              {label}
              {year !== currentYear && (
                <span style={{ color: '#484F58', marginLeft: 2 }}>
                  '{year.slice(2)}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
