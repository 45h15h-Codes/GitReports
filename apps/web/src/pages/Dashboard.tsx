import { useState, useEffect }            from 'react'
import {
  GitCommit, GitBranch, ArrowFatLineUp, GitMerge,
} from '@phosphor-icons/react'
import { MonthSelector }          from '../components/MonthSelector'
import { StatCard }               from '../components/StatCard'
import { CommitChart }            from '../components/CommitChart'
import { InsightsPanel }          from '../components/InsightsPanel'
import ProfileCard                from '../components/ProfileCard'
import { GenerateReportButton }   from '../components/GenerateReportButton'
import { SocialShare }            from '../components/SocialShare'
import { useAuth }                from '../context/AuthContext'
import { useAvailableMonths }     from '../hooks/useAvailableMonths'
import { useMonthlyReport }       from '../hooks/useMonthlyReport'
import { deltaPercent, formatLines, formatPeriod } from '../utils/persona'
import { ApiError }               from '../lib/api'

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

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen animate-pulse" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded" style={{ background: 'var(--border-default)' }} />
          <div className="h-8 w-48 rounded" style={{ background: 'var(--border-default)' }} />
        </div>
        <div className="h-9 w-32 rounded" style={{ background: 'var(--border-default)' }} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 380px' }}>
        <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      </div>
    </div>
  )
}

// ── Empty state — no reports yet ──────────────────────────────────────────────

function NoReportsState() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center justify-center flex-1 gap-6 mt-24">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
        >
          <GitCommit size={28} weight="duotone" style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="text-center">
          <h1
            className="font-display font-bold text-[24px] mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            No reports yet
            {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="font-mono text-[13px] mb-6" style={{ color: 'var(--text-secondary)' }}>
            Generate your first monthly developer report from your GitHub activity.
          </p>
          <GenerateReportButton variant="primary" />
        </div>
      </div>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ error }: { error: Error }) {
  const is404 = error instanceof ApiError && error.status === 404
  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-24">
        <div className="font-display font-bold text-[20px]" style={{ color: 'var(--text-primary)' }}>
          {is404 ? 'Report not found for this period' : 'Failed to load report'}
        </div>
        <p className="font-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          {is404
            ? 'Generate a report for this period to see your stats.'
            : error.message}
        </p>
        {is404 && <GenerateReportButton variant="primary" />}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user }                        = useAuth()
  const { months, isLoading: loadingMonths } = useAvailableMonths()

  // Default to most recent available month, or previous month if no reports yet
  const defaultPeriod = months[0] ?? (() => {
    const now  = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  })()

  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod)

  // Sync selected period when months load
  useEffect(() => {
    if (months.length > 0 && !months.includes(selectedPeriod)) {
      setSelectedPeriod(months[0]!)
    }
  }, [months])  // eslint-disable-line react-hooks/exhaustive-deps

  const { data: report, isLoading: loadingReport, error } = useMonthlyReport(
    months.length > 0 ? selectedPeriod : undefined,
  )

  // ── Loading state
  if (loadingMonths || loadingReport) return <DashboardSkeleton />

  // ── No reports yet
  if (months.length === 0) return <NoReportsState />

  // ── Report fetch error
  if (error) return <ErrorState error={error} />

  // ── No report for selected period (404)
  if (!report) {
    return (
      <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              Monthly Report
            </div>
            <h1 className="font-display font-bold text-[28px] leading-tight" style={{ color: 'var(--text-primary)' }}>
              {formatPeriod(selectedPeriod)}
            </h1>
          </div>
          <MonthSelector months={months} selected={selectedPeriod} onSelect={setSelectedPeriod} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-16">
          <p className="font-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            No report for {formatPeriod(selectedPeriod)} yet.
          </p>
          <GenerateReportButton period={selectedPeriod} variant="primary" onSuccess={() => {
            void 0 // invalidation handled inside GenerateReportButton
          }} />
        </div>
      </div>
    )
  }

  const payload = report.payload
  const prev    = payload.prev_period_summary
  const commitsDelta = prev ? deltaPercent(payload.total_commits, prev.total_commits) : undefined

  const profileName   = user?.displayName ?? user?.username ?? report.persona ?? '—'
  const profileHandle = user?.username ?? '—'
  const profileAvatar = user?.avatarUrl ?? `https://ui-avatars.com/api/?name=${profileHandle}&background=161B22&color=8B949E`

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div
            className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
          >
            Monthly Report
          </div>
          <h1
            className="font-display font-bold text-[28px] leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {formatPeriod(selectedPeriod)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <GenerateReportButton period={selectedPeriod} variant="subtle" />
          <MonthSelector
            months={months}
            selected={selectedPeriod}
            onSelect={setSelectedPeriod}
          />
        </div>
      </div>

      {/* Narrative status banner — only if still generating */}
      {report.narrativeStatus === 'pending' || report.narrativeStatus === 'generating' ? (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-[12px]"
          style={{ background: '#1F3450', border: '1px solid #58A6FF22', color: '#58A6FF' }}
          role="status"
          aria-live="polite"
        >
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: '#58A6FF' }} />
          Narrative is being generated — this usually takes 10–20 seconds.
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Commits"
          value={payload.total_commits}
          delta={commitsDelta}
          icon={<GitCommit size={16} weight="duotone" />}
          accent="var(--accent-blue)"
        />
        <StatCard
          label="Repos"
          value={payload.repos_touched ?? payload.repos?.length ?? 0}
          icon={<GitBranch size={16} weight="duotone" />}
          accent="var(--accent-green)"
        />
        <StatCard
          label="Lines Added"
          value={payload.lines_added_total ?? 0}
          formatter={formatLines}
          icon={<ArrowFatLineUp size={16} weight="duotone" />}
          accent="var(--accent-yellow)"
        />
        <StatCard
          label="PRs Merged"
          value={payload.prs_merged_total ?? 0}
          icon={<GitMerge size={16} weight="duotone" />}
          accent="var(--accent-purple)"
        />
      </div>

      {/* Main row: chart area + insights panel */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 380px' }}>
        <div className="flex flex-col gap-4">
          <CommitChart
            key={selectedPeriod}
            dailyCommits={payload.daily_commits ?? []}
            period={selectedPeriod}
          />

          {/* Language breakdown */}
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
              {Object.entries(payload.languages)
                .sort((a, b) => b[1] - a[1])
                .map(([lang, pct]) => (
                  <div key={lang} className="flex items-center gap-3">
                    <span className="font-mono text-[12px] w-20 shrink-0" style={{ color: 'var(--text-secondary)' }}>
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

          {/* Activity meta */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Days',    value: payload.active_days,    suffix: 'd' },
              { label: 'Longest Streak', value: payload.longest_streak, suffix: 'd' },
              { label: 'Current Streak', value: payload.current_streak, suffix: 'd' },
            ].map(item => (
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
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <InsightsPanel
            persona={payload.developer_persona}
            focusScore={payload.focus_score}
            prevFocusScore={prev?.focus_score}
            aiSummary={
              report.narrative ??
              (report.narrativeStatus === 'failed'
                ? 'Narrative generation failed.'
                : 'Narrative is being generated…')
            }
            period={selectedPeriod}
          />

          <ProfileCard
            name={profileName}
            title={payload.developer_persona}
            handle={profileHandle}
            status={`${payload.total_commits} commits · ${payload.longest_streak}d streak`}
            avatarUrl={profileAvatar}
            contactText="Share Report"
            showUserInfo={true}
            enableTilt={false}
            enableMobileTilt={false}
            behindGlowEnabled={true}
            onContactClick={() =>
              window.open(`/u/${profileHandle}/${payload.period}`, '_blank')
            }
          />

          {/* Share + Challenge buttons */}
          <div className="flex flex-col gap-2">
            <a
              id="dashboard-share-btn"
              href={`/u/${profileHandle}/${payload.period}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-150"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share this report
            </a>

            <a
              id="dashboard-challenge-btn"
              href={`/challenge/${profileHandle}/${payload.period}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-150"
              style={{ background: '#2D1810', color: 'var(--accent-orange)', border: '1px solid #D85A3033', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3D2010'; e.currentTarget.style.color = '#E87040' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2D1810'; e.currentTarget.style.color = 'var(--accent-orange)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Send a challenge
            </a>

            <div className="pt-2 pb-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <SocialShare
                caption={`I shipped ${payload.total_commits} commits in ${formatPeriod(payload.period)} as ${payload.developer_persona}. Think you can beat that?`}
                url={`${window.location.origin}/challenge/${profileHandle}/${payload.period}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
