import { useEffect, useRef, memo } from 'react'

import { ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react'

interface StatCardProps {
  label:      string
  value:      number
  formatter?: (n: number) => string
  delta?:     number        // percent vs prev period, positive = up
  icon?:      React.ReactNode
  accent?:    string
}

export const StatCard = memo(function StatCard({
  label,
  value,
  formatter = (n) => n.toLocaleString(),
  delta,
  icon,
  accent = '#58A6FF',
}: StatCardProps) {
  const rootRef    = useRef<HTMLDivElement>(null)
  const numRef     = useRef<HTMLSpanElement>(null)
  const counterObj = useRef({ val: 0 })

  useEffect(() => {
    if (!numRef.current || !rootRef.current) return

    const el      = numRef.current
    const counter = counterObj.current

    // gsap.context() scopes all tweens to rootRef — ctx.revert() kills them on unmount
    let ctx: any;
    import('gsap').then(({ gsap }) => {
      if (!rootRef.current || !numRef.current) return;
      ctx = gsap.context(() => {
        counter.val = 0
        gsap.to(counter, {
          val:      value,
          duration: 0.7,
          ease:     'expo.out',
          onUpdate: () => {
            el.textContent = formatter(Math.round(counter.val))
          },
        })
      }, rootRef)
    });

    return () => ctx?.revert()
  }, [value, formatter])

  const deltaColor =
    delta === undefined || delta === 0 ? '#484F58'
    : delta > 0 ? '#3FB950'
    : '#F85149'

  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus
    : delta > 0 ? ArrowUp
    : ArrowDown

  return (
    <div
      ref={rootRef}
      className="relative rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
    >
      {/* Accent top bar — color-coded per stat, not persona */}
      <div
        className="absolute top-0 left-5 right-5 h-[2px] rounded-full"
        style={{ background: `${accent}33` }}
      />

      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/50"
        >
          {label}
        </span>
        {icon && <span style={{ color: accent, opacity: 0.7 }}>{icon}</span>}
      </div>

      <span
        ref={numRef}
        className="font-display font-medium tabular-nums text-white"
        style={{
          fontSize: '3rem',
          lineHeight: 1,
        }}
        aria-label={`${label}: ${formatter(value)}`}
      >
        {formatter(0)}
      </span>

      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-0.5 font-mono text-[11px] font-medium"
            style={{ color: deltaColor }}
          >
            <DeltaIcon size={11} weight="bold" />
            {Math.abs(delta)}%
          </span>
          <span className="font-mono text-[11px] text-white/40">
            vs last month
          </span>
        </div>
      )}
    </div>
  )
})
