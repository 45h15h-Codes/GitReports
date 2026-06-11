import { useQuery } from '@tanstack/react-query'
import { getReport } from '../lib/api'
import type { MonthlyReport } from '../types/api'

interface UseMonthlyReportResult {
  data:      MonthlyReport | null
  isLoading: boolean
  error:     Error | null
  isEmpty:   boolean
}

/**
 * Fetch the full report for a specific period.
 * Returns null (isEmpty=true) on 404 — user hasn't generated this period yet.
 */
export function useMonthlyReport(period: string | undefined): UseMonthlyReportResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['report', period],
    queryFn:  async () => {
      const res = await getReport(period!)
      return (res as any).report
    },
    enabled:  !!period,
    // Short stale time — dashboard needs fresh data after report generation
    staleTime: 60 * 1000,
  })

  return {
    data:      data ?? null,
    isLoading,
    error:     error as Error | null,
    isEmpty:   !isLoading && !data && !error,
  }
}
