import type { DeveloperPersona } from '../types/api'

export const PERSONA_META: Record<
  DeveloperPersona,
  { color: string; bg: string; border: string; label: string }
> = {
  // Colors from PRD §4.3 — reserved, do not reuse
  'The Architect':               { color: '#185FA5', bg: '#0D2340', border: '#185FA533', label: 'Architect' },
  'The Shipper':                 { color: '#3FB950', bg: '#0F2D1A', border: '#3FB95033', label: 'Shipper' },
  'The Maintainer':              { color: '#888780', bg: '#1E1E1D', border: '#88878033', label: 'Maintainer' },
  'The Explorer':                { color: '#E3B341', bg: '#2D2310', border: '#E3B34133', label: 'Explorer' },
  'The Open Source Contributor': { color: '#BC8CFF', bg: '#1F1B2E', border: '#BC8CFF33', label: 'Open Source' },
  'The Builder':                 { color: '#D85A30', bg: '#2D1810', border: '#D85A3033', label: 'Builder' },
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  return new Date(parseInt(year), parseInt(month) - 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function formatMonthShort(period: string): string {
  const [year, month] = period.split('-')
  return new Date(parseInt(year), parseInt(month) - 1)
    .toLocaleString('en-US', { month: 'short' })
}

export function formatMonthYear(period: string): string {
  const [year] = period.split('-')
  return year
}

export function deltaPercent(current: number, prev: number): number {
  if (prev === 0) return 0
  return Math.round(((current - prev) / prev) * 100)
}

export function formatLines(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
