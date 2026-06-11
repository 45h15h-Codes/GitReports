/**
 * ErrorState — error boundary fallback shown when report fetch fails.
 * Distinguishes 404 (no report for period) from other errors.
 */

import { ApiError } from '../lib/api'
import { GenerateReportButton } from './GenerateReportButton'

interface ErrorStateProps {
  error: Error
}

export function ErrorState({ error }: ErrorStateProps) {
  const is404 = error instanceof ApiError && error.status === 404
  return (
    <div className="flex flex-col gap-8 p-8 min-h-screen bg-[#090909]">
      <div className="flex flex-col items-center justify-center flex-1 gap-4 mt-24">
        <div className="font-display font-bold text-[20px] text-white">
          {is404 ? 'Report not found for this period' : 'Failed to load report'}
        </div>
        <p className="font-mono text-[13px] text-white/60">
          {is404
            ? 'Generate a report for this period to see your stats.'
            : error.message}
        </p>
        {is404 && <GenerateReportButton variant="primary" />}
      </div>
    </div>
  )
}
