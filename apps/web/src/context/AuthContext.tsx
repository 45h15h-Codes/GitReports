/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, logout as apiLogout, redirectToGitHub, ApiError } from '../lib/api'
import type { AuthUser } from '../types/api'
import { useNavigate } from 'react-router-dom'

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:            AuthUser | null
  isAuthenticated: boolean
  isLoading:       boolean
  login:           () => void
  logout:          () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate     = useNavigate()
  const qc           = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn:  async () => {
      try {
        return await getMe()
      } catch (err) {
        // 401 = not authenticated — not an error we want to propagate
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    // Poll auth state infrequently — session is cookie-based
    staleTime: 10 * 60 * 1000,
  })

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSettled:  () => {
      // Wipe all cached data and redirect to login
      qc.clear()
      navigate('/login')
    },
  })

  const value: AuthContextValue = {
    user:            data?.user ?? null,
    isAuthenticated: !!data?.user,
    isLoading,
    login:           redirectToGitHub,
    logout:          () => logoutMutation.mutate(),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
