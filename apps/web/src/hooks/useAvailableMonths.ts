import { useQuery } from '@tanstack/react-query'
import { getReports } from '../lib/api'

/**
 * Fetch the list of available report periods for the authenticated user.
 * Returns periods sorted newest first ('YYYY-MM' or 'YYYY' strings).
 */
export function useAvailableMonths(): {
  months:    string[]
  isLoading: boolean
  error:     Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports'],
    queryFn:  getReports,
    staleTime: 5 * 60 * 1000,
  })

  const months = (data?.reports ?? [])
    .map(r => r.period)
    .sort((a, b) => b.localeCompare(a))  // newest first

  return {
    months,
    isLoading,
    error: error as Error | null,
  }
}
