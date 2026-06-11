import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { AuthUser } from '../types/api'

interface UseCinematicModeResult {
  isCinematic: boolean
  isLoading:   boolean
}

/**
 * Checks whether the current user should see the cinematic first-run.
 * Reads hasSeenCinematic from /auth/me, marks it seen immediately so
 * a tab close mid-sequence doesn't replay it.
 *
 * PRD §4.2: fires once per user, never again.
 * Respects prefers-reduced-motion — GSAP is never even imported in that case.
 */
export function useCinematicMode(): UseCinematicModeResult {
  const [isCinematic, setIsCinematic] = useState(false)
  const [isLoading,   setIsLoading  ] = useState(true)

  useEffect(() => {
    // Respect prefers-reduced-motion — never show cinematic if user prefers it
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setIsLoading(false)
      return
    }

    async function checkAndMark() {
      try {
        const res = await api.getMe() as { user: AuthUser }
        const me  = res.user

        if (!me.hasSeenCinematic) {
          setIsCinematic(true)
          // Mark seen immediately — if user closes mid-sequence they don't replay it
          await api.markCinematicSeen()
        }
      } catch {
        // API failure → fall through to fast mode silently
      } finally {
        setIsLoading(false)
      }
    }

    void checkAndMark()
  }, [])

  return { isCinematic, isLoading }
}
