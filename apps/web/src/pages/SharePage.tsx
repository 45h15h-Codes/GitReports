import { useState, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { getReports } from '../lib/api'
import { SocialShare } from '../components/SocialShare'
import { ProfileCard } from '../components/ProfileCard'
import type { ReportListItem } from '../types/api'
import { Share2, Swords, UserCircle, LayoutTemplate } from 'lucide-react'

gsap.registerPlugin(useGSAP)

export function SharePage() {
  const containerRef = useRef<HTMLDivElement>(null)
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

  useGSAP(() => {
    gsap.from('.gsap-animate', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'all'
    })
  }, { scope: containerRef, dependencies: [completed.length, selectedPeriod] })

  return (
    <div ref={containerRef} className="flex flex-col gap-8 p-6 md:p-12 min-h-screen bg-[#090909] text-white selection:bg-[#0099ff] selection:text-white">
      {/* Header */}
      <div className="gsap-animate flex flex-col gap-2 border-b border-white/5 pb-8">
        <div className="text-[13px] font-medium text-[#888888] uppercase tracking-[0.2em]">
          Viral Tools
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-none text-white">
          Share
        </h1>
      </div>

      {/* Content */}
      {completed.length === 0 ? (
        <div className="gsap-animate rounded-[32px] p-16 flex flex-col items-center text-center bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <Share2 size={48} className="text-[#333333] mb-6" strokeWidth={1} />
          <h2 className="text-2xl font-bold tracking-tight mb-2">No reports to share yet</h2>
          <p className="text-[#888888] text-sm max-w-sm">
            Generate a report first, then come back to share it with your network.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Left — share panels */}
          <div className="flex flex-col gap-5">
            {/* Report selector */}
            <div className="gsap-animate rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <div className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.15em] mb-4">
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
                      className="text-[13px] font-medium px-4 py-2 rounded-full cursor-pointer transition-all duration-200"
                      style={{
                        background: isActive ? '#ffffff' : '#222222',
                        color:      isActive ? '#000000' : '#888888',
                        boxShadow:  !isActive ? 'inset 0 0 0 1px rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Share report */}
              {reportUrl && (
                <div className="gsap-animate rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col">
                  <div className="w-10 h-10 rounded-full bg-[#222222] flex items-center justify-center mb-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                    <Share2 size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1">Share Report</h3>
                  <p className="text-[13px] text-[#888888] mb-6 flex-1">
                    Share your {monthName} stats publicly on X or LinkedIn.
                  </p>
                  <SocialShare caption={shareCaption} url={reportUrl} />
                </div>
              )}

              {/* Challenge link */}
              {challengeUrl && (
                <div className="gsap-animate rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col">
                  <div className="w-10 h-10 rounded-full bg-[#222222] flex items-center justify-center mb-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                    <Swords size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white mb-1">Challenge Someone</h3>
                  <p className="text-[13px] text-[#888888] mb-6 flex-1">
                    Dare another developer to beat your {monthName} stats.
                  </p>
                  <SocialShare caption={challengeCaption} url={challengeUrl} />
                </div>
              )}

              {/* Public profile link */}
              {user?.username && (
                <div className="gsap-animate md:col-span-2 rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 mb-1">
                      <UserCircle size={18} className="text-white" />
                      <h3 className="text-lg font-bold tracking-tight text-white">Public Profile</h3>
                    </div>
                    <p className="text-[13px] text-[#888888]">
                      {frontendUrl}/u/{user.username}
                    </p>
                  </div>
                  <div className="shrink-0 w-full sm:w-auto">
                    <SocialShare
                      caption={`Check out my developer profile on GitReport`}
                      url={`${frontendUrl}/u/${user.username}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — Dev Card preview */}
          <div className="sticky top-8 flex flex-col gap-5">
            <div className="rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col items-center text-center">
              <div className="flex items-center gap-2 text-[11px] font-medium text-[#888888] uppercase tracking-[0.15em] mb-6">
                <LayoutTemplate size={14} /> Card Preview
              </div>
              <div className="w-full pointer-events-none mb-6">
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
              </div>
              <p className="text-[12px] text-[#888888] leading-relaxed max-w-[240px]">
                Your developer card serves as the open graph image when sharing your profile.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
