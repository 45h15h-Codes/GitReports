import { useParams, Link }   from 'react-router-dom'
import { useQuery }           from '@tanstack/react-query'
import { ProfileCard }        from '../components/ProfileCard'
import { ShareCTA }           from '../components/ShareCTA'
import { api, getPublicReport } from '../lib/api'
import { formatPeriod }       from '../utils/persona'
import { ApiError }           from '../lib/api'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SharedReportSkeleton() {
  return (
    <div className="min-h-screen pb-24 animate-pulse" style={{ background: '#0D1117' }}>
      <nav className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #21262D' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md" style={{ background: '#21262D' }} />
          <div className="h-4 w-20 rounded" style={{ background: '#21262D' }} />
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="h-8 w-48 rounded" style={{ background: '#21262D' }} />
        <div className="h-4 w-64 rounded" style={{ background: '#21262D' }} />
        <div className="h-64 rounded-xl" style={{ background: '#161B22' }} />
        <div className="h-32 rounded-xl" style={{ background: '#161B22' }} />
      </main>
    </div>
  )
}

// ── Not found / error ────────────────────────────────────────────────────────

function SharedReportError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
      <div className="text-center">
        <div className="font-display font-bold text-[24px] mb-2" style={{ color: '#E6EDF3' }}>
          Report not found
        </div>
        <div className="font-mono text-[13px] mb-6" style={{ color: '#8B949E' }}>
          {message}
        </div>
        <Link to="/" className="font-mono text-[12px]" style={{ color: '#58A6FF' }}>
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}

// ── SharedReport ──────────────────────────────────────────────────────────────

export function SharedReport() {
  const { username, period } = useParams<{ username: string; period: string }>()

  const isValidPeriod = period && /^\d{4}-\d{2}$/.test(period)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public', username, period],
    queryFn:  () => getPublicReport(username!, period!),
    enabled:  !!username && !!isValidPeriod,
    staleTime: 10 * 60 * 1000,
    retry:     false,  // 404 is definitive, don't retry
  })

  if (!username || !isValidPeriod) {
    return <SharedReportError message="This report doesn't exist or the link is invalid." />
  }

  if (isLoading) return <SharedReportSkeleton />

  if (error) {
    const msg = error instanceof ApiError && error.status === 404
      ? 'This report is private or doesn\'t exist.'
      : 'Failed to load this report. Please try again.'
    return <SharedReportError message={msg} />
  }

  if (!data) return <SharedReportError message="Report unavailable." />

  const { user: reportUser, report } = data
  const payload = report.payload

  return (
    <>
      <title>{`${reportUser.displayName ?? reportUser.username}'s ${formatPeriod(report.period)} — GitReport`}</title>

      <div className="min-h-screen pb-24" style={{ background: '#0D1117' }}>
        {/* Nav */}
        <nav
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #21262D' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#58A6FF' }}>
              <svg width="11" height="11" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <polygon points="7.5,1 2,7.5 6.5,7.5 5.5,12 11,5.5 6.5,5.5" fill="#0D1117" />
              </svg>
            </div>
            <span className="font-display font-bold text-[14px]" style={{ color: '#E6EDF3' }}>
              GitReport
            </span>
          </div>
          {/* Link from individual report back to profile archive */}
          {username && (
            <Link
              to={`/u/${username}`}
              className="font-mono text-[12px]"
              style={{ color: '#8B949E', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#E6EDF3' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8B949E' }}
            >
              ← {username}'s profile
            </Link>
          )}
          <ShareCTA variant="inline" />
        </nav>

        <main className="max-w-2xl mx-auto px-6 py-10">

          {/* Report header */}
          <div className="mb-8">
            <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: '#484F58', letterSpacing: '0.1em' }}>
              {username}'s report
            </div>
            <h1 className="font-display font-bold text-[32px] leading-tight mb-1" style={{ color: '#E6EDF3' }}>
              {formatPeriod(report.period)}
            </h1>
            <p className="font-mono text-[13px]" style={{ color: '#8B949E' }}>
              {payload.total_commits} commits · {payload.active_days} active days · {payload.longest_streak}d longest streak
            </p>
          </div>

          {/* Profile Card */}
          <div className="flex justify-center mb-10">
            <ProfileCard
              name={reportUser.displayName ?? reportUser.username}
              title={payload.developer_persona}
              handle={reportUser.username}
              status={`${payload.total_commits} commits · ${payload.active_days} active days`}
              avatarUrl={reportUser.avatarUrl ?? `https://ui-avatars.com/api/?name=${reportUser.username}&background=161B22&color=8B949E`}
              contactText="Generate yours →"
              showUserInfo={true}
              enableTilt={false}
              enableMobileTilt={false}
              behindGlowEnabled={true}
              onContactClick={() => window.location.href = '/login'}
            />
          </div>

          {/* AI summary */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#161B22', border: '1px solid #21262D' }}>
            <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58', letterSpacing: '0.08em' }}>
              Monthly Summary
            </div>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: '#8B949E' }}>
              {report.narrative ?? 'Narrative is being generated…'}
            </p>
          </div>

          {/* Public stats */}
          <div className="rounded-xl p-6 mb-6" style={{ background: '#161B22', border: '1px solid #21262D' }}>
            <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58', letterSpacing: '0.08em' }}>
              Public Activity
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Commits',     value: payload.total_commits },
                { label: 'PRs Merged',  value: payload.prs_merged_total ?? 0 },
                { label: 'Lines Added', value: `${((payload.lines_added_total ?? 0) / 1000).toFixed(1)}k` },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="font-display font-bold text-[28px] leading-none mb-1" style={{ color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}>
                    {item.value}
                  </div>
                  <div className="font-mono text-[11px]" style={{ color: '#484F58' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => api.exportReportPdf(username!, period!)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-150 cursor-pointer"
              style={{
                background: '#1C2128',
                color:      '#8B949E',
                border:     '1px solid #30363D',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#21262D'
                e.currentTarget.style.color      = '#E6EDF3'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1C2128'
                e.currentTarget.style.color      = '#8B949E'
              }}
              aria-label="Download PDF report"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download PDF
            </button>
          </div>

          {/* Languages */}
          <div className="rounded-xl p-6" style={{ background: '#161B22', border: '1px solid #21262D' }}>
            <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58', letterSpacing: '0.08em' }}>
              Languages
            </div>
            {Object.entries(payload.languages)
              .sort((a, b) => b[1] - a[1])
              .map(([lang, pct]) => (
                <div key={lang} className="flex items-center gap-3 mb-2.5">
                  <span className="font-mono text-[12px] w-24 shrink-0" style={{ color: '#8B949E' }}>
                    {lang}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: '#21262D' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#58A6FF' }} />
                  </div>
                  <span className="font-mono text-[11px] w-8 text-right shrink-0" style={{ color: '#484F58' }}>
                    {pct}%
                  </span>
                </div>
              ))}
          </div>
        </main>
      </div>

      <ShareCTA variant="sticky" />
    </>
  )
}
