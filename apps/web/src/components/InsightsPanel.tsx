import { useEffect, useRef, memo } from 'react'

import { Lock, Sparkle } from '@phosphor-icons/react'
import type { DeveloperPersona } from '../types/api'
import { PERSONA_META } from '../utils/persona'

interface InsightsPanelProps {
  persona:        DeveloperPersona
  focusScore:     number
  prevFocusScore?: number
  aiSummary:      string
  period:         string
}

const RADIUS = 30

export const InsightsPanel = memo(function InsightsPanel({
  persona,
  focusScore,
  prevFocusScore,
  aiSummary,
  period,
}: InsightsPanelProps) {
  const rootRef  = useRef<HTMLDivElement>(null)
  const gaugeRef = useRef<SVGCircleElement>(null)
  const meta     = PERSONA_META[persona]

  const [year, month] = period.split('-')
  const monthName = new Date(parseInt(year), parseInt(month) - 1)
    .toLocaleString('en-US', { month: 'long' })

  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  useEffect(() => {
    if (!gaugeRef.current || !rootRef.current) return

    // Compute inside effect — satisfies exhaustive-deps
    const circumference = 2 * Math.PI * RADIUS

    let ctx: any;
    import('gsap').then(({ gsap }) => {
      if (!gaugeRef.current || !rootRef.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          gaugeRef.current,
          { strokeDashoffset: circumference },
          {
            strokeDashoffset: circumference * (1 - focusScore),
            duration: 1,
            ease:     'expo.out',
            delay:    0.2,
          }
        )
      }, rootRef)
    });

    return () => ctx?.revert()
  }, [focusScore])

  const focusDelta = prevFocusScore !== undefined
    ? Math.round((focusScore - prevFocusScore) * 100)
    : null

  return (
    <div
      ref={rootRef}
      className="rounded-[2rem] p-5 flex flex-col gap-5 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-widest"
          style={{ color: '#484F58', letterSpacing: '0.08em' }}
        >
          AI Insights — {monthName}
        </div>
        <Sparkle size={14} weight="duotone" color="#58A6FF" style={{ opacity: 0.6 }} />
      </div>

      {/* Persona + Focus score */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
          <span
            className="font-mono text-[11px] font-medium"
            style={{ color: meta.color }}
            aria-label={`Developer persona: ${persona}`}
          >
            {meta.label}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[10px]" style={{ color: '#484F58' }}>Focus</span>
            <span
              className="font-mono text-[18px] font-bold"
              style={{ color: '#E6EDF3', lineHeight: 1 }}
            >
              {Math.round(focusScore * 100)}
              <span className="text-[11px]" style={{ color: '#8B949E' }}>%</span>
            </span>
            {focusDelta !== null && (
              <span
                className="font-mono text-[10px]"
                style={{ color: focusDelta >= 0 ? '#3FB950' : '#F85149' }}
              >
                {focusDelta >= 0 ? '+' : ''}{focusDelta}pp
              </span>
            )}
          </div>

          {/* SVG gauge — PRD §4 focus score visual */}
          <svg
            width="72" height="72" viewBox="0 0 72 72"
            aria-label={`Focus score: ${Math.round(focusScore * 100)}%`}
          >
            {/* Track */}
            <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="#21262D" strokeWidth="5" />
            {/* Prev period ghost — PRD §6.1 longitudinal context */}
            {prevFocusScore !== undefined && (
              <circle
                cx="36" cy="36" r={RADIUS}
                fill="none"
                stroke={meta.color}
                strokeWidth="1"
                strokeOpacity="0.2"
                strokeDasharray={`${CIRCUMFERENCE * prevFocusScore} ${CIRCUMFERENCE}`}
                transform="rotate(-90 36 36)"
              />
            )}
            {/* Animated fill */}
            <circle
              ref={gaugeRef}
              cx="36" cy="36" r={RADIUS}
              fill="none"
              stroke={meta.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE}
              transform="rotate(-90 36 36)"
            />
          </svg>
        </div>
      </div>

      <div style={{ height: 1, background: '#21262D' }} />

      {/* AI Summary — PRD §3.7 */}
      <p
        className="font-mono text-[12px] leading-relaxed"
        style={{ color: '#8B949E' }}
      >
        {aiSummary}
      </p>

      {/* PRD §4.4 — privacy label is non-removable on all shared surfaces */}
      <div
        className="flex items-center gap-1.5 pt-1"
        style={{ borderTop: '1px solid #21262D' }}
      >
        <Lock size={11} weight="thin" color="#484F58" />
        <span className="font-mono text-[11px]" style={{ color: '#484F58' }}>
          Showing public activity only. Private repos excluded.
        </span>
      </div>
    </div>
  )
})
