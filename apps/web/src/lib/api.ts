const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface AchievementResponse {
  achievementId: string
  title:         string
  description:   string
  meta:          Record<string, unknown> | null
  unlockedAt:    string
  period:        string
}

export interface PublicProfileReport {
  period:       string
  persona:      string | null
  focusScore:   string | null
  totalCommits: number
  narrative:    string | null
  generatedAt:  string
}

export interface PublicProfileAchievement {
  achievementId: string
  title:         string
  description:   string
  unlockedAt:    string
  period:        string
}

export interface PublicProfile {
  user: {
    username:    string
    displayName: string | null
    avatarUrl:   string | null
  }
  reports:      PublicProfileReport[]
  achievements: PublicProfileAchievement[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError((body as { message?: string }).message ?? 'Request failed', res.status)
  }

  return res.json() as Promise<T>
}

// ── api object — used by useCinematicMode and direct callers ──────────────────

export const api = {
  getReport:         (period: string) => request(`/reports/${period}`),
  generateReport:    (period?: string) => request('/reports/generate', {
    method: 'POST',
    body:   JSON.stringify({ period }),
  }),
  getReports:        () => request('/reports'),
  getMe:             () => request('/auth/me'),
  logout:            () => request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    body:   '{}',
  }),
  markCinematicSeen: () => request<{ ok: boolean }>('/auth/cinematic-seen', {
    method: 'POST',
    body:   '{}',
  }),
  exportReportPdf: (username: string, period: string) => {
    // Opens download directly — no fetch needed, browser handles Content-Disposition
    const url = `${BASE_URL}/reports/export/${username}/${period}`
    window.open(url, '_blank')
  },
  getAchievements:    () => request<{ achievements: AchievementResponse[] }>('/achievements'),
  getPublicProfile:   (username: string) => request<PublicProfile>(`/public/u/${username}`),
}

// ── Named exports — consumed by AuthContext, hooks, and components ─────────────

export async function getMe<T = unknown>(): Promise<T> {
  return request<T>('/auth/me')
}

export async function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    body:   '{}',
  })
}

export async function saveGeminiKey(apiKey: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/gemini-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  })
}

export function redirectToGitHub(): void {
  window.location.href = `${BASE_URL}/auth/github`
}

export async function getPublicReport<T = unknown>(username: string, period: string): Promise<T> {
  return request<T>(`/public/u/${username}/${period}`)
}

export async function getReports<T = unknown>(): Promise<T> {
  return request<T>('/reports')
}

export async function getReport<T = unknown>(period: string): Promise<T> {
  return request<T>(`/reports/${period}`)
}

export async function generateReport<T = unknown>(period?: string): Promise<T> {
  return request<T>('/reports/generate', {
    method: 'POST',
    body:   JSON.stringify({ period }),
  })
}

/**
 * streamReportStatus — opens SSE for real-time narrative generation status.
 * Returns a cleanup fn that closes the EventSource.
 */
export function streamReportStatus(
  period:  string,
  onData:  (data: { narrativeStatus: string; narrative?: string }) => void,
  onError: (err: Event) => void,
): () => void {
  const es = new EventSource(`${BASE_URL}/reports/${period}/stream`, { withCredentials: true })

  es.onmessage = (event) => {
    try {
      onData(JSON.parse(event.data) as { narrativeStatus: string; narrative?: string })
    } catch {
      // ignore malformed frames
    }
  }

  es.onerror = (err) => {
    onError(err)
    es.close()
  }

  return () => es.close()
}
