/**
 * API client — single source of truth for all backend communication.
 *
 * All methods return typed responses or throw ApiError.
 * Credentials (session cookie) are always included.
 */

import type {
  AuthUser,
  GenerateReportResponse,
  MonthlyReport,
  NarrativeStatusResponse,
  PublicReportResponse,
  ReportsListResponse,
} from '../types/api'

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001'

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Base fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> ?? {}) }
  if (init?.body) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** GET /auth/me — returns authenticated user or throws 401 */
export async function getMe(): Promise<{ user: AuthUser }> {
  return apiFetch('/auth/me')
}

/** POST /auth/logout — destroys session */
export async function logout(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' })
}

/** Redirect to GitHub OAuth (full page navigation) */
export function redirectToGitHub(): void {
  window.location.href = `${API_BASE}/auth/github`
}

// ── Reports ───────────────────────────────────────────────────────────────────

/** GET /reports — list of report metadata for authenticated user */
export async function getReports(): Promise<ReportsListResponse> {
  return apiFetch('/reports')
}

/** GET /reports/:period — full report for authenticated user */
export async function getReport(period: string): Promise<{ report: MonthlyReport }> {
  return apiFetch(`/reports/${period}`)
}

/** GET /reports/:period/status — lightweight narrative status poll */
export async function getReportStatus(period: string): Promise<NarrativeStatusResponse> {
  return apiFetch(`/reports/${period}/status`)
}

/**
 * POST /reports/generate — trigger ingestion + narrative pipeline.
 * Returns immediately with narrativeStatus: 'pending'.
 * Poll getReportStatus() until complete | failed.
 */
export async function generateReport(period?: string): Promise<GenerateReportResponse> {
  return apiFetch('/reports/generate', {
    method: 'POST',
    body:   period ? JSON.stringify({ period }) : undefined,
  })
}

// ── Public surfaces ───────────────────────────────────────────────────────────

/** GET /public/u/:username/:period — public report (private repos stripped server-side) */
export async function getPublicReport(
  username: string,
  period:   string,
): Promise<PublicReportResponse> {
  return apiFetch(`/public/u/${username}/${period}`)
}
