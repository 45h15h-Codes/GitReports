import { useState, useEffect, useRef }     from 'react'
import { useMutation, useQueryClient }     from '@tanstack/react-query'
import { Lightning, ArrowClockwise }       from '@phosphor-icons/react'
import { generateReport, getReportStatus } from '../lib/api'
import type { NarrativeStatus }            from '../types/api'

interface GenerateReportButtonProps {
  period?:    string   // defaults to previous month
  onSuccess?: () => void
  variant?:   'primary' | 'subtle'
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS  = 30_000

type ButtonState = 'idle' | 'generating' | 'polling' | 'done' | 'timeout' | 'error'

export function GenerateReportButton({
  period,
  onSuccess,
  variant = 'primary',
}: GenerateReportButtonProps) {
  const qc               = useQueryClient()
  const [state, setState] = useState<ButtonState>('idle')
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stopPolling() {
    if (pollRef.current)   clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pollRef.current    = null
    timeoutRef.current = null
  }

  async function pollStatus(p: string) {
    try {
      const res = await getReportStatus(p)
      handleStatusUpdate(res.narrativeStatus, p)
    } catch {
      // Transient poll failure — keep going until timeout
    }
  }

  function handleStatusUpdate(status: NarrativeStatus, p: string) {
    if (status === 'complete') {
      stopPolling()
      setState('done')
      // Invalidate so dashboard picks up fresh data
      void qc.invalidateQueries({ queryKey: ['report', p] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
      onSuccess?.()
    } else if (status === 'failed') {
      stopPolling()
      setState('error')
      // Invalidate so dashboard shows failed state
      void qc.invalidateQueries({ queryKey: ['report', p] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    }
    // 'pending' | 'generating' → keep polling
  }

  function startPolling(p: string) {
    setState('polling')
    pollRef.current = setInterval(() => void pollStatus(p), POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setState('timeout')
    }, POLL_TIMEOUT_MS)
  }

  const mutation = useMutation({
    mutationFn: () => generateReport(period),
    onMutate:   () => setState('generating'),
    onSuccess:  (data) => {
      const p = data.report.period
      if (data.report.narrativeStatus === 'complete') {
        // Already complete (cached report) — skip polling
        void qc.invalidateQueries({ queryKey: ['report', p] })
        void qc.invalidateQueries({ queryKey: ['reports'] })
        setState('done')
        onSuccess?.()
      } else {
        startPolling(p)
      }
    },
    onError: () => setState('error'),
  })

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [])

  // Reset after 3s in done/timeout/error so user can retry
  useEffect(() => {
    if (state === 'done' || state === 'timeout' || state === 'error') {
      const t = setTimeout(() => setState('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [state])

  const label: Record<ButtonState, string> = {
    idle:       'Generate Report',
    generating: 'Fetching data…',
    polling:    'Generating narrative…',
    done:       'Report ready ✓',
    timeout:    'Still working — check back soon',
    error:      'Failed — retry?',
  }

  const isPending = state === 'generating' || state === 'polling'

  const bg: Record<ButtonState, string> = {
    idle:       variant === 'primary' ? '#1F3450' : '#161B22',
    generating: '#1F3450',
    polling:    '#1F3450',
    done:       '#0F2D1A',
    timeout:    '#2D2310',
    error:      '#2D1010',
  }

  const color: Record<ButtonState, string> = {
    idle:       '#58A6FF',
    generating: '#58A6FF',
    polling:    '#58A6FF',
    done:       '#3FB950',
    timeout:    '#E3B341',
    error:      '#F85149',
  }

  return (
    <button
      id="generate-report-btn"
      onClick={() => {
        if (!isPending) mutation.mutate()
      }}
      disabled={isPending}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] font-medium transition-all duration-200"
      style={{
        background: bg[state],
        color:      color[state],
        border:     `1px solid ${color[state]}33`,
        cursor:     isPending ? 'not-allowed' : 'pointer',
        minWidth:   200,
      }}
      aria-live="polite"
      aria-label={label[state]}
    >
      {isPending
        ? <ArrowClockwise size={13} className="animate-spin" />
        : <Lightning size={13} weight="duotone" />}
      {label[state]}
    </button>
  )
}
