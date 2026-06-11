import { useState }              from 'react'
import { useAuth }              from '../context/AuthContext'
import { useQuery }             from '@tanstack/react-query'
import { getReports }           from '../lib/api'
import { SocialShare }          from '../components/SocialShare'
import { ProfileCard }          from '../components/ProfileCard'
import type { ReportListItem }  from '../types/api'

export function SharePage() {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => getReports<{ reports: ReportListItem[] }>(),
  })

  const completed = (data?.reports ?? [])
    .filter(r => r.narrativeStatus === 'complete')
    .sort((a, b) => b.period.localeCompare(a.period))

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(
    completed[0]?.period ?? null,
  )

  const period = selectedPeriod ?? completed[0]?.period

  const frontendUrl  = window.location.origin
  const reportUrl    = period && user?.username
    ? `${frontendUrl}/u/${user.username}/${period}`
    : null
  const challengeUrl = period && user?.username
    ? `${frontendUrl}/challenge/${user.username}/${period}`
    : null

  const [year, month] = (period ?? '').split('-')
  const monthName = period
    ? new Date(parseInt(year!), parseInt(month!) - 1)
        .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const selectedReport = completed.find(r => r.period === period)
  const shareCaption     = `I shipped my ${monthName} GitReport. Here's what I built.`
  const challengeCaption = `I shipped ${monthName} as ${selectedReport?.persona ?? 'a developer'}. Think you can beat my stats?`

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: '#0D1117' }}>

      {/* Header */}
      <div>
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
          style={{ color: '#484F58', letterSpacing: '0.1em' }}
        >
          Viral Tools
        </div>
        <h1
          className="font-display font-bold text-[28px] leading-tight"
          style={{ color: '#E6EDF3' }}
        >
          Share
        </h1>
      </div>

      {completed.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: '#161B22', border: '1px solid #21262D' }}
        >
          <div className="font-display font-bold text-[20px] mb-2" style={{ color: '#E6EDF3' }}>
            No reports to share yet
          </div>
          <p className="font-mono text-[13px]" style={{ color: '#8B949E' }}>
            Generate a report first, then come back to share it.
          </p>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 320px' }}>

          {/* Left — share panels */}
          <div className="flex flex-col gap-4">

            {/* Report selector */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#161B22', border: '1px solid #21262D' }}
            >
              <div className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: '#484F58' }}>
                Select Report
              </div>
              <div className="flex flex-wrap gap-2">
                {completed.map(r => {
                  const [y, m] = r.period.split('-')
                  const label = new Date(parseInt(y!), parseInt(m!) - 1)
                    .toLocaleString('en-US', { month: 'short', year: '2-digit' })
                  const isActive = r.period === (selectedPeriod ?? completed[0]?.period)
                  return (
                    <button
                      key={r.period}
                      onClick={() => setSelectedPeriod(r.period)}
                      className="font-mono text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150"
                      style={{
                        background: isActive ? '#1F3450' : '#1C2128',
                        color:      isActive ? '#58A6FF' : '#8B949E',
                        border:     `1px solid ${isActive ? '#58A6FF33' : '#30363D'}`,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Share report */}
            {reportUrl && (
              <div
                className="rounded-xl p-5"
                style={{ background: '#161B22', border: '1px solid #21262D' }}
              >
                <div className="font-mono text-[11px] uppercase tracking-widest mb-1" style={{ color: '#484F58' }}>
                  Share Report
                </div>
                <p className="font-mono text-[12px] mb-4 mt-2" style={{ color: '#8B949E' }}>
                  Share your {monthName} stats publicly.
                </p>
                <SocialShare caption={shareCaption} url={reportUrl} />
              </div>
            )}

            {/* Challenge link */}
            {challengeUrl && (
              <div
                className="rounded-xl p-5"
                style={{ background: '#161B22', border: '1px solid #21262D' }}
              >
                <div className="font-mono text-[11px] uppercase tracking-widest mb-1" style={{ color: '#484F58' }}>
                  Challenge Someone
                </div>
                <p className="font-mono text-[12px] mb-4 mt-2" style={{ color: '#8B949E' }}>
                  Dare another developer to beat your {monthName} stats.
                </p>
                <SocialShare caption={challengeCaption} url={challengeUrl} />
              </div>
            )}

            {/* Public profile link */}
            {user?.username && (
              <div
                className="rounded-xl p-5"
                style={{ background: '#161B22', border: '1px solid #21262D' }}
              >
                <div className="font-mono text-[11px] uppercase tracking-widest mb-1" style={{ color: '#484F58' }}>
                  Your Public Profile
                </div>
                <p className="font-mono text-[12px] mt-2 mb-3" style={{ color: '#8B949E' }}>
                  {frontendUrl}/u/{user.username}
                </p>
                <SocialShare
                  caption={`Check out my developer profile on GitReport`}
                  url={`${frontendUrl}/u/${user.username}`}
                />
              </div>
            )}
          </div>

          {/* Right — Dev Card preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: '#484F58' }}>
              Card Preview
            </div>
            <ProfileCard
              avatarUrl={user?.avatarUrl ?? undefined}
              miniAvatarUrl={user?.avatarUrl ?? undefined}
              name={user?.displayName ?? user?.username ?? 'Developer'}
              handle={user?.username ?? 'dev'}
              title={selectedReport?.persona ?? 'Developer'}
              status="Active"
              contactText="View Report"
              showUserInfo
            />
            <p className="font-mono text-[10px] text-center" style={{ color: '#484F58' }}>
              Your developer card. Real stats on your public profile.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
