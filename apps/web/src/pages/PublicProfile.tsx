import { useParams, Link }          from 'react-router-dom'
import { useQuery }                   from '@tanstack/react-query'
import { api }                        from '../lib/api'
import { AchievementBadge }           from '../components/AchievementBadge'
import { ShareCTA }                   from '../components/ShareCTA'
import { PERSONA_META }               from '../utils/persona'
import type { PublicProfileReport }   from '../lib/api'
import type { DeveloperPersona }      from '../types/api'

// ── Persona color helper ─────────────────────────────────────────────────────

function getPersonaColor(persona: string | null): string {
  if (!persona) return '#484F58'
  return PERSONA_META[persona as DeveloperPersona]?.color ?? '#484F58'
}

// ── Commit bar mini-sparkline ────────────────────────────────────────────────

function CommitSparkline({ commits }: { commits: number }) {
  const max = 200
  const pct = Math.min(100, Math.round((commits / max) * 100))
  return (
    <div
      className="h-1 rounded-full"
      style={{ width: `${Math.max(4, pct)}%`, background: '#3FB950', opacity: 0.7 }}
    />
  )
}

// ── Report timeline card ─────────────────────────────────────────────────────

function ReportTimelineCard({
  report,
  username,
}: {
  report: PublicProfileReport
  username: string
}) {
  const [year, month] = report.period.split('-')
  const monthName = new Date(parseInt(year!), parseInt(month!) - 1)
    .toLocaleString('en-US', { month: 'short', year: 'numeric' })

  const personaColor = getPersonaColor(report.persona)

  return (
    <Link
      to={`/u/${username}/${report.period}`}
      style={{ textDecoration: 'none' }}
    >
      <div
        className="rounded-xl p-4 transition-all duration-150 cursor-pointer"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#30363D' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262D' }}
      >
        {/* Month + persona */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="font-mono text-[12px] font-medium"
            style={{ color: '#E6EDF3' }}
          >
            {monthName}
          </span>
          {report.persona && (
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full"
              style={{
                color:      personaColor,
                background: `${personaColor}18`,
                border:     `1px solid ${personaColor}33`,
              }}
            >
              {report.persona.replace('The ', '')}
            </span>
          )}
        </div>

        {/* Commit count + sparkline */}
        <div className="mb-2">
          <span
            className="font-display font-bold text-[22px] leading-none"
            style={{ color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}
          >
            {report.totalCommits.toLocaleString()}
          </span>
          <span
            className="font-mono text-[10px] ml-1.5"
            style={{ color: '#484F58' }}
          >
            commits
          </span>
        </div>
        <CommitSparkline commits={report.totalCommits} />

        {/* Narrative excerpt */}
        {report.narrative && (
          <p
            className="font-mono text-[11px] leading-relaxed mt-3"
            style={{
              color:           '#8B949E',
              display:         '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow:        'hidden',
            } as React.CSSProperties}
          >
            {report.narrative}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function PublicProfileSkeleton() {
  return (
    <div className="min-h-screen animate-pulse" style={{ background: '#0D1117' }}>
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid #21262D' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md" style={{ background: '#21262D' }} />
          <div className="h-4 w-20 rounded" style={{ background: '#21262D' }} />
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full" style={{ background: '#21262D' }} />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 rounded" style={{ background: '#21262D' }} />
            <div className="h-3 w-20 rounded" style={{ background: '#21262D' }} />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-xl" style={{ background: '#161B22' }} />
        ))}
      </main>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

import React from 'react'

export function PublicProfile() {
  const { username } = useParams<{ username: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-profile', username],
    queryFn:  () => api.getPublicProfile(username!),
    enabled:  !!username,
    retry:    1,
  })

  if (isLoading) return <PublicProfileSkeleton />

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0D1117' }}
      >
        <div className="text-center">
          <div
            className="font-display font-bold text-[24px] mb-2"
            style={{ color: '#E6EDF3' }}
          >
            Profile not found
          </div>
          <div
            className="font-mono text-[13px] mb-6"
            style={{ color: '#8B949E' }}
          >
            This developer hasn't made any public reports yet.
          </div>
          <Link to="/" className="font-mono text-[12px]" style={{ color: '#58A6FF' }}>
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const { user, reports, achievements } = data

  // Career stats
  const totalCommits  = reports.reduce((s, r) => s + r.totalCommits, 0)
  const totalMonths   = reports.length

  // Dominant persona
  const personaCounts: Record<string, number> = {}
  reports.forEach(r => {
    if (r.persona) personaCounts[r.persona] = (personaCounts[r.persona] ?? 0) + 1
  })
  const dominantPersona = Object.entries(personaCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const dominantColor = getPersonaColor(dominantPersona)

  return (
    <>
      <title>{`${user.displayName ?? user.username} — GitReport`}</title>

      <div className="min-h-screen pb-24" style={{ background: '#0D1117' }}>

        {/* Nav */}
        <nav
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #21262D' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: '#58A6FF' }}
            >
              <svg width="11" height="11" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <polygon points="7.5,1 2,7.5 6.5,7.5 5.5,12 11,5.5 6.5,5.5" fill="#0D1117" />
              </svg>
            </div>
            <span
              className="font-display font-bold text-[14px]"
              style={{ color: '#E6EDF3' }}
            >
              GitReport
            </span>
          </div>
          <ShareCTA variant="inline" />
        </nav>

        <main className="max-w-2xl mx-auto px-6 py-10">

          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`${user.displayName ?? user.username} avatar`}
                className="w-16 h-16 rounded-full"
                style={{ border: `2px solid ${dominantColor}44` }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-[24px]"
                style={{ background: '#161B22', color: dominantColor }}
              >
                {(user.displayName ?? user.username)[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h1
                className="font-display font-bold text-[24px] leading-tight"
                style={{ color: '#E6EDF3' }}
              >
                {user.displayName ?? user.username}
              </h1>
              <div className="font-mono text-[12px]" style={{ color: '#8B949E' }}>
                @{user.username}
              </div>
              {dominantPersona && (
                <div className="mt-1">
                  <span
                    className="font-mono text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      color:      dominantColor,
                      background: `${dominantColor}18`,
                      border:     `1px solid ${dominantColor}33`,
                    }}
                  >
                    {dominantPersona}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Career stats */}
          {totalMonths > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Total Commits',  value: totalCommits.toLocaleString() },
                { label: 'Months Tracked', value: String(totalMonths)           },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-xl p-4"
                  style={{ background: '#161B22', border: '1px solid #21262D' }}
                >
                  <div
                    className="font-display font-bold text-[28px] leading-none"
                    style={{ color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="font-mono text-[11px] mt-1"
                    style={{ color: '#484F58' }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <div
              className="rounded-xl p-5 mb-8"
              style={{ background: '#161B22', border: '1px solid #21262D' }}
            >
              <div
                className="font-mono text-[11px] uppercase tracking-widest mb-4"
                style={{ color: '#484F58', letterSpacing: '0.08em' }}
              >
                Achievements · {achievements.length}
              </div>
              <div className="flex flex-wrap gap-4">
                {achievements.map(a => (
                  <AchievementBadge
                    key={a.achievementId}
                    achievement={{ ...a, meta: null }}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Monthly report timeline */}
          {reports.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: '#161B22', border: '1px solid #21262D' }}
            >
              <div className="font-mono text-[13px]" style={{ color: '#484F58' }}>
                No public reports yet.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div
                className="font-mono text-[11px] uppercase tracking-widest mb-1"
                style={{ color: '#484F58', letterSpacing: '0.08em' }}
              >
                Monthly Reports · {reports.length}
              </div>
              {[...reports].reverse().map(r => (
                <ReportTimelineCard key={r.period} report={r} username={username!} />
              ))}
            </div>
          )}

        </main>
      </div>

      <ShareCTA variant="sticky" />
    </>
  )
}
