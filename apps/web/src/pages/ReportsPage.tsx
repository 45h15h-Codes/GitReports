import { Link }                  from 'react-router-dom'
import { useQuery }              from '@tanstack/react-query'
import { getReports, api }       from '../lib/api'
import { PERSONA_META }          from '../utils/persona'
import { GenerateReportButton }  from '../components/GenerateReportButton'
import type { ReportListItem }   from '../types/api'
import type { DeveloperPersona } from '../types/api'

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return new Date(parseInt(y!), parseInt(m!) - 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function StatusPill({ status }: { status: string }) {
  const config = {
    complete:   { color: '#3FB950', bg: '#0F2D1A', label: 'Complete'   },
    generating: { color: '#E3B341', bg: '#2D2310', label: 'Generating' },
    pending:    { color: '#8B949E', bg: '#1C2128', label: 'Pending'    },
    queued:     { color: '#8B949E', bg: '#1C2128', label: 'Queued'     },
    failed:     { color: '#F85149', bg: '#2D1010', label: 'Failed'     },
  }[status] ?? { color: '#8B949E', bg: '#1C2128', label: status }

  return (
    <span
      className="font-mono text-[10px] px-2 py-0.5 rounded-full"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.color}22` }}
    >
      {config.label}
    </span>
  )
}

export function ReportsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => getReports<{ reports: ReportListItem[] }>(),
  })

  const reports = data?.reports ?? []

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: '#0D1117' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div
            className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
            style={{ color: '#484F58', letterSpacing: '0.1em' }}
          >
            History
          </div>
          <h1
            className="font-display font-bold text-[28px] leading-tight"
            style={{ color: '#E6EDF3' }}
          >
            Your Reports
          </h1>
        </div>
        <GenerateReportButton onGenerated={() => refetch()} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#161B22', border: '1px solid #21262D' }}
        >
          <p className="font-mono text-[13px]" style={{ color: '#F85149' }}>
            Failed to load reports. Try refreshing.
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: '#161B22', border: '1px solid #21262D' }}
        >
          <div
            className="font-display font-bold text-[20px] mb-2"
            style={{ color: '#E6EDF3' }}
          >
            No reports yet
          </div>
          <p className="font-mono text-[13px] mb-6" style={{ color: '#8B949E' }}>
            Generate your first monthly report to get started.
          </p>
          <GenerateReportButton onGenerated={() => refetch()} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...reports]
            .sort((a, b) => b.period.localeCompare(a.period))
            .map(report => {
              const meta = report.persona
                ? PERSONA_META[report.persona as DeveloperPersona]
                : null

              return (
                <div
                  key={report.period}
                  className="rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap"
                  style={{ background: '#161B22', border: '1px solid #21262D' }}
                >
                  <div className="flex items-center gap-4">
                    {/* Persona color dot */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: meta?.color ?? '#484F58' }}
                    />
                    <div>
                      <div
                        className="font-mono text-[14px] font-medium"
                        style={{ color: '#E6EDF3' }}
                      >
                        {periodLabel(report.period)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusPill status={report.narrativeStatus} />
                        {report.persona && (
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: meta?.color ?? '#8B949E' }}
                          >
                            {report.persona}
                          </span>
                        )}
                        {report.focusScore && (
                          <span className="font-mono text-[10px]" style={{ color: '#484F58' }}>
                            Focus {Math.round(parseFloat(report.focusScore) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Visibility badge */}
                    <span
                      className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        color:      report.isPublic ? '#58A6FF' : '#8B949E',
                        background: report.isPublic ? '#1F3450' : '#1C2128',
                        border:     `1px solid ${report.isPublic ? '#58A6FF33' : '#30363D'}`,
                      }}
                    >
                      {report.isPublic ? 'Public' : 'Private'}
                    </span>

                    {report.narrativeStatus === 'complete' && (
                      <Link
                        to={`/u/${report.period}`}
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
                    )}

                    <button
                      onClick={() => api.exportReportPdf(report.period.split('-')[0]!, report.period)}
                      className="font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                      style={{
                        color:      '#8B949E',
                        background: '#1C2128',
                        border:     '1px solid #30363D',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E6EDF3' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#8B949E' }}
                      title="Download PDF"
                    >
                      PDF
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
