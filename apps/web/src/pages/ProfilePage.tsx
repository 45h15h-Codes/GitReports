import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { PERSONA_META } from '../utils/persona'
import { useQuery } from '@tanstack/react-query'
import { getReports } from '../lib/api'
import type { ReportListItem } from '../types/api'
import type { DeveloperPersona } from '../types/api'
import { GitBranch, ExternalLink, Activity, FileText } from 'lucide-react'

gsap.registerPlugin(useGSAP)

export function ProfilePage() {
  const containerRef = useRef<HTMLDivElement>(null)
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

  useGSAP(() => {
    gsap.from('.gsap-animate', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'all'
    })
  }, { scope: containerRef, dependencies: [completed.length] })

  return (
    <div ref={containerRef} className="flex flex-col gap-8 p-6 md:p-12 min-h-screen bg-[#090909] text-white selection:bg-[#0099ff] selection:text-white">
      {/* Header */}
      <div className="gsap-animate flex flex-col gap-2 border-b border-white/5 pb-8">
        <div className="text-[13px] font-medium text-[#888888] uppercase tracking-[0.2em]">
          Account
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-none text-white">
          Profile
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Profile card */}
        <div className="gsap-animate md:col-span-2 rounded-[32px] p-8 flex items-center gap-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] relative overflow-hidden">
          {/* Subtle gradient background based on persona */}
          {meta && (
            <div 
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none"
              style={{ background: meta.color }}
            />
          )}

          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName ?? user.username}
              className="w-20 h-20 rounded-full shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shrink-0 bg-[#222222] text-[#888888] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              {(user?.displayName ?? user?.username ?? '?')[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col items-start z-10">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
              {user?.displayName ?? user?.username}
            </h2>
            <div className="text-[14px] text-[#888888] font-medium">
              @{user?.username}
            </div>
            {dominantPersona && meta && (
              <div className="mt-3">
                <span
                  className="text-[11px] font-medium px-3 py-1.5 rounded-full uppercase tracking-wider"
                  style={{
                    color:      meta.color,
                    background: `${meta.color}15`,
                    boxShadow:  `inset 0 0 0 1px ${meta.color}30`,
                  }}
                >
                  {dominantPersona}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="gsap-animate rounded-[32px] p-8 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col justify-between">
          <div className="flex items-center gap-3 text-[#888888] mb-6">
            <FileText size={18} />
            <span className="text-[13px] font-medium uppercase tracking-wider">Reports Generated</span>
          </div>
          <div className="text-6xl font-bold tracking-tighter text-white">
            {completed.length}
          </div>
        </div>

        <div className="gsap-animate rounded-[32px] p-8 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col justify-between">
          <div className="flex items-center gap-3 text-[#888888] mb-6">
            <Activity size={18} />
            <span className="text-[13px] font-medium uppercase tracking-wider">Months Tracked</span>
          </div>
          <div className="text-6xl font-bold tracking-tighter text-white">
            {completed.length}
          </div>
        </div>

        {/* Public profile link */}
        {user?.username && (
          <div className="gsap-animate md:col-span-2 rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] hover:bg-[#1a1a1a] transition-colors">
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-semibold text-white">
                Public Profile
              </div>
              <div className="text-[13px] text-[#888888]">
                gitreport.dev/u/{user.username}
              </div>
            </div>
            <Link
              to={`/u/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-full bg-white text-black transition-transform duration-150 active:scale-95"
            >
              View Profile <ExternalLink size={14} />
            </Link>
          </div>
        )}

        {/* GitHub connection info */}
        <div className="gsap-animate md:col-span-2 rounded-[24px] p-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#222222] flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <GitBranch size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <div className="text-[15px] font-semibold text-white">
                GitHub Account
              </div>
              <div className="text-[13px] text-[#888888]">
                @{user?.username}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.4)]" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#888888]">Connected</span>
          </div>
        </div>
      </div>
    </div>
  )
}
