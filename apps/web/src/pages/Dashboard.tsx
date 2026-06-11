import { useState, useEffect }            from 'react'
import { GitCommit, GitBranch, ArrowFatLineUp, GitMerge } from '@phosphor-icons/react'
import { useCinematicMode }        from '../hooks/useCinematicMode'
import { CinematicReport }         from '../components/CinematicReport'
import { MonthSelector }          from '../components/MonthSelector'
import { StatCard }               from '../components/StatCard'
import { CommitChart }            from '../components/CommitChart'
import { InsightsPanel }          from '../components/InsightsPanel'
import { ProfileCard }            from '../components/ProfileCard'
import { GenerateReportButton }   from '../components/GenerateReportButton'
import { SocialShare }            from '../components/SocialShare'
import { DashboardSkeleton }      from '../components/DashboardSkeleton'
import { NoReportsState }         from '../components/NoReportsState'
import { ErrorState }             from '../components/ErrorState'
import { LanguageBreakdown }      from '../components/LanguageBreakdown'
import { ActivityMeta }           from '../components/ActivityMeta'
import { useAuth }                from '../context/AuthContext'
import { useAvailableMonths }     from '../hooks/useAvailableMonths'
import { useMonthlyReport }       from '../hooks/useMonthlyReport'
import { deltaPercent, formatLines, formatPeriod } from '../utils/persona'
import { AchievementsPanel } from '../components/AchievementsPanel'

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user }                            = useAuth()
  const { months, isLoading: loadingMonths } = useAvailableMonths()
  const { isCinematic, isLoading: cinematicLoading } = useCinematicMode()
  const [showCinematic, setShowCinematic]   = useState(true)

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
  if (loadingMonths || loadingReport || cinematicLoading) return <DashboardSkeleton />

  // ── No reports yet
  if (months.length === 0) return <NoReportsState />

  // ── Report fetch error
  if (error) return <ErrorState error={error} />

  // ── No report for selected period (404)
  if (!report) {
    return (
      <div className="flex flex-col gap-8 p-8 min-h-screen bg-[#090909]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/50 mb-2">
              Monthly Report
            </div>
            <h1 className="font-display font-medium text-4xl tracking-tight text-white">
              {formatPeriod(selectedPeriod)}
            </h1>
          </div>
          <MonthSelector months={months} selected={selectedPeriod} onSelect={setSelectedPeriod} />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-16">
          <p className="font-mono text-[13px] text-white/60">
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

  // ── Cinematic first-run gate — PRD §4.2 ───────────────────────────────────
  if (isCinematic && showCinematic && user) {
    return (
      <CinematicReport
        payload={payload}
        user={user}
        period={selectedPeriod}
        narrative={report.narrative}
        onComplete={() => {
          window.scrollTo(0, 0)
          setShowCinematic(false)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 p-8 min-h-screen bg-[#090909]">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div
            className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/50 mb-2"
          >
            Monthly Report
          </div>
          <h1
            className="font-display font-medium text-4xl tracking-tight text-white"
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

          <LanguageBreakdown languages={payload.languages} />

          <ActivityMeta
            activeDays={payload.active_days}
            longestStreak={payload.longest_streak}
            currentStreak={payload.current_streak}
          />
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
              className="dashboard-action-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-150"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', textDecoration: 'none' }}
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
              className="dashboard-challenge-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-150"
              style={{ background: '#2D1810', color: 'var(--accent-orange)', border: '1px solid #D85A3033', textDecoration: 'none' }}
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

      {/* Achievements — PRD §5.4 */}
      <AchievementsPanel />
    </div>
  )
}
