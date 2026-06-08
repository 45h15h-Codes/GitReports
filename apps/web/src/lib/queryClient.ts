import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 min stale time — report data doesn't change frequently
      staleTime:          5 * 60 * 1000,
      // Retry twice, but not on 401/404 (auth / not found)
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          return false
        }
        return failureCount < 2
      },
      // Don't refetch on window focus for report data
      refetchOnWindowFocus: false,
    },
  },
})
