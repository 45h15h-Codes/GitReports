import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getReports, api } from '../lib/api'
import { PERSONA_META } from '../utils/persona'
import { GenerateReportButton } from '../components/GenerateReportButton'
import type { ReportListItem } from '../types/api'
import type { DeveloperPersona } from '../types/api'
import { ArrowRight, Download, FileText } from 'lucide-react'

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return new Date(parseInt(y!), parseInt(m!) - 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function StatusPill({ status }: { status: string }) {
  const config = {
    complete:   { color: '#ffffff', bg: '#222222', label: 'Complete'   },
    generating: { color: '#ffffff', bg: '#443311', label: 'Generating' },
    pending:    { color: '#888888', bg: '#1a1a1a', label: 'Pending'    },
    queued:     { color: '#888888', bg: '#1a1a1a', label: 'Queued'     },
    failed:     { color: '#ff4444', bg: '#331111', label: 'Failed'     },
  }[status] ?? { color: '#888888', bg: '#1a1a1a', label: status }

  return (
    <span
      className="font-medium text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ color: config.color, background: config.bg, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05)` }}
    >
      {config.label}
    </span>
  )
}

gsap.registerPlugin(useGSAP)

export function ReportsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => getReports<{ reports: ReportListItem[] }>(),
  })

  const reports = data?.reports ?? []

  useGSAP(() => {
    gsap.from('.gsap-animate', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'all'
    })
  }, { scope: containerRef, dependencies: [reports.length, isLoading] })

  return (
    <div ref={containerRef} className="flex flex-col gap-8 p-6 md:p-12 min-h-screen bg-[#090909] text-white selection:bg-[#0099ff] selection:text-white">
      {/* Header */}
      <div className="gsap-animate flex items-end justify-between flex-wrap gap-6 border-b border-white/5 pb-8">
        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-medium text-[#888888] uppercase tracking-[0.2em]">
            History
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-none text-white">
            Your Reports
          </h1>
        </div>
        <GenerateReportButton onGenerated={() => refetch()} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="gsap-animate h-24 rounded-3xl bg-[#141414] animate-pulse shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
          ))}
        </div>
      ) : error ? (
        <div className="gsap-animate rounded-3xl p-8 text-center bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-[14px] text-[#ff4444] font-medium">
            Failed to load reports. Try refreshing.
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div className="gsap-animate rounded-3xl p-16 flex flex-col items-center text-center bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <FileText size={48} className="text-[#333333] mb-6" strokeWidth={1} />
          <h2 className="text-2xl font-bold tracking-tight mb-2">No reports yet</h2>
          <p className="text-[#888888] text-sm mb-8 max-w-sm">
            Generate your first monthly report to unlock insights, achievements, and your developer persona.
          </p>
          <GenerateReportButton onGenerated={() => refetch()} />
        </div>
      ) : (
        <div className="grid gap-4">
          {[...reports]
            .sort((a, b) => b.period.localeCompare(a.period))
            .map(report => {
              const meta = report.persona
                ? PERSONA_META[report.persona as DeveloperPersona]
                : null

              return (
                <div
                  key={report.period}
                  className="gsap-animate group rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:bg-[#1a1a1a]"
                >
                  <div className="flex items-center gap-5">
                    {/* Persona color dot */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                      style={{ background: meta?.color ?? '#444444' }}
                    />
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[16px] font-semibold tracking-tight text-white">
                        {periodLabel(report.period)}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <StatusPill status={report.narrativeStatus} />
                        {report.persona && (
                          <span
                            className="text-[12px] font-medium"
                            style={{ color: meta?.color ?? '#888888' }}
                          >
                            {report.persona}
                          </span>
                        )}
                        {report.focusScore && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[#333333]" />
                            <span className="text-[12px] text-[#888888] font-medium">
                              Focus {Math.round(parseFloat(report.focusScore) * 100)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Visibility badge */}
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wider"
                      style={{
                        color:      report.isPublic ? '#0099ff' : '#888888',
                        background: report.isPublic ? 'rgba(0,153,255,0.1)' : '#1a1a1a',
                        boxShadow:  `inset 0 0 0 1px ${report.isPublic ? 'rgba(0,153,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      {report.isPublic ? 'Public' : 'Private'}
                    </span>

                    {report.narrativeStatus === 'complete' && (
                      <Link
                        to={`/u/${report.period}`}
                        className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-full bg-white text-black transition-transform duration-150 active:scale-95"
                      >
                        View <ArrowRight size={14} />
                      </Link>
                    )}

                    <button
                      onClick={() => api.exportReportPdf(report.period.split('-')[0]!, report.period)}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-[#222222] text-[#888888] transition-all duration-150 hover:bg-[#333333] hover:text-white active:scale-95 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
