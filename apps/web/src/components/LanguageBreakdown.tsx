/**
 * LanguageBreakdown — horizontal bar chart of language usage percentages.
 * Rendered as part of the dashboard report view.
 */

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python:     '#3572A5',
  PHP:        '#4F5D95',
  CSS:        '#563D7C',
  HTML:       '#E44B23',
  Go:         '#00ADD8',
  Rust:       '#DEA584',
}

interface LanguageBreakdownProps {
  languages: Record<string, number>
}

export function LanguageBreakdown({ languages }: LanguageBreakdownProps) {
  const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1])

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="font-mono text-[11px] font-medium uppercase tracking-widest mb-4"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
      >
        Languages
      </div>
      <div className="flex flex-col gap-2.5">
        {sorted.map(([lang, pct]) => (
          <div key={lang} className="flex items-center gap-3">
            <span className="font-mono text-[12px] w-20 shrink-0 text-white/60">
              {lang}
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border-default)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: LANG_COLORS[lang] ?? 'var(--accent-blue)' }}
              />
            </div>
            <span className="font-mono text-[11px] w-8 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
