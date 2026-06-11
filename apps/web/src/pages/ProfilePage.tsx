import { useAuth }              from '../context/AuthContext'
import { Link }                from 'react-router-dom'
import { PERSONA_META }        from '../utils/persona'
import { useQuery }            from '@tanstack/react-query'
import { getReports }          from '../lib/api'
import type { ReportListItem } from '../types/api'
import type { DeveloperPersona } from '../types/api'

export function ProfilePage() {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => getReports<{ reports: ReportListItem[] }>(),
  })

  const reports   = data?.reports ?? []
  const completed = reports.filter(r => r.narrativeStatus === 'complete')

  // Dominant persona
  const personaCounts: Record<string, number> = {}
  completed.forEach(r => {
    if (r.persona) personaCounts[r.persona] = (personaCounts[r.persona] ?? 0) + 1
  })
  const dominantPersona = Object.entries(personaCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as DeveloperPersona | undefined

  const meta = dominantPersona ? PERSONA_META[dominantPersona] : null

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: '#0D1117' }}>

      {/* Header */}
      <div>
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
          style={{ color: '#484F58', letterSpacing: '0.1em' }}
        >
          Account
        </div>
        <h1
          className="font-display font-bold text-[28px] leading-tight"
          style={{ color: '#E6EDF3' }}
        >
          Profile
        </h1>
      </div>

      {/* Profile card */}
      <div
        className="rounded-xl p-6 flex items-center gap-5"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName ?? user.username}
            className="w-16 h-16 rounded-full shrink-0"
            style={{ border: `2px solid ${meta?.color ?? '#30363D'}` }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-[24px] shrink-0"
            style={{ background: '#1C2128', color: meta?.color ?? '#8B949E' }}
          >
            {(user?.displayName ?? user?.username ?? '?')[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div
            className="font-display font-bold text-[20px]"
            style={{ color: '#E6EDF3' }}
          >
            {user?.displayName ?? user?.username}
          </div>
          <div className="font-mono text-[12px] mt-0.5" style={{ color: '#8B949E' }}>
            @{user?.username}
          </div>
          {dominantPersona && meta && (
            <div className="mt-2">
              <span
                className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  color:      meta.color,
                  background: meta.bg,
                  border:     `1px solid ${meta.color}33`,
                }}
              >
                {dominantPersona}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Reports Generated', value: completed.length },
          { label: 'Months Tracked',    value: completed.length },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl p-5"
            style={{ background: '#161B22', border: '1px solid #21262D' }}
          >
            <div
              className="font-display font-bold text-[32px] leading-none"
              style={{ color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}
            >
              {stat.value}
            </div>
            <div className="font-mono text-[11px] mt-1" style={{ color: '#484F58' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Public profile link */}
      {user?.username && (
        <div
          className="rounded-xl p-5 flex items-center justify-between"
          style={{ background: '#161B22', border: '1px solid #21262D' }}
        >
          <div>
            <div className="font-mono text-[13px] font-medium" style={{ color: '#E6EDF3' }}>
              Public Profile
            </div>
            <div className="font-mono text-[11px] mt-0.5" style={{ color: '#484F58' }}>
              gitreport.dev/u/{user.username}
            </div>
          </div>
          <Link
            to={`/u/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all duration-150"
            style={{
              color:          '#58A6FF',
              background:     '#1F3450',
              border:         '1px solid #58A6FF33',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A3060' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1F3450' }}
          >
            View →
          </Link>
        </div>
      )}

      {/* GitHub connection info */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
          Connected Account
        </div>
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#8B949E" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <div>
            <div className="font-mono text-[13px]" style={{ color: '#E6EDF3' }}>
              GitHub
            </div>
            <div className="font-mono text-[11px]" style={{ color: '#8B949E' }}>
              @{user?.username} · Connected
            </div>
          </div>
          <div
            className="ml-auto w-2 h-2 rounded-full"
            style={{ background: '#3FB950' }}
          />
        </div>
      </div>
    </div>
  )
}
