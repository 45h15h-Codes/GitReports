/**
 * CinematicReport — PRD §4.2 nine-beat ScrollTrigger sequence.
 *
 * Fires once per user (gated by useCinematicMode).
 * GSAP + SplitText are lazy-imported — zero bundle cost on fast-mode loads.
 * After the pinned section scrolls past (onLeave), parent switches to fast mode.
 */
import { useEffect, useRef } from 'react'
import { Lock }              from '@phosphor-icons/react'
import type { AiPayload }    from '../types/api'
import type { AuthUser }     from '../types/api'
import { PERSONA_META, formatPeriod, formatLines } from '../utils/persona'
import { ProfileCard }       from './ProfileCard'

interface CinematicReportProps {
  payload:    AiPayload
  user:       AuthUser
  period:     string
  narrative:  string | null
  onComplete: () => void  // called when sequence scrolls past → switch to fast mode
}

function barColor(count: number, max: number): string {
  if (count === 0) return '#21262D'
  const r = count / max
  if (r < 0.25) return '#0E4429'
  if (r < 0.5)  return '#006D32'
  if (r < 0.75) return '#26A641'
  return '#39D353'
}

export function CinematicReport({
  payload,
  user,
  period,
  narrative,
  onComplete,
}: CinematicReportProps) {
  const rootRef     = useRef<HTMLDivElement>(null)
  const contentRef  = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const summaryRef  = useRef<HTMLParagraphElement>(null)

  const meta = PERSONA_META[payload.developer_persona]
  const max  = Math.max(...payload.daily_commits, 1)

  const [year, month] = period.split('-')
  const monthName = new Date(parseInt(year), parseInt(month) - 1)
    .toLocaleString('en-US', { month: 'long' })

  const avatarUrl = user.avatarUrl
    ?? `https://ui-avatars.com/api/?name=${user.username}&background=161B22&color=8B949E`

  const prev = payload.prev_period_summary
  const commitsDelta = prev && prev.total_commits > 0
    ? Math.round(((payload.total_commits - prev.total_commits) / prev.total_commits) * 100)
    : null

  useEffect(() => {
    let isCancelled = false
    let gsapCtx: { revert: () => void } | null = null

    // Force scroll to top so GSAP doesn't initialize past the start point
    window.scrollTo(0, 0)

    async function runSequence() {
      // Lazy-import GSAP + plugins — only here, never in fast mode
      const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/SplitText'),
      ])

      if (isCancelled) return

      gsap.registerPlugin(ScrollTrigger, SplitText)

      if (!rootRef.current) return

      gsapCtx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger:  rootRef.current,
            scroller: window,
            start:    'top top',
            end:      '+=4000',
            scrub:    1,
            pin:      true,
            snap: {
              snapTo:   'labels',
              duration: { min: 0.2, max: 0.5 },
              ease:     'power1.inOut',
            },
            onLeave: onComplete,
          },
        })

        // Beat 1 — avatar badge + persona chip
        tl.addLabel('beat1')
          .from('#cin-badge', { opacity: 0, y: 16, duration: 0.3 }, 'beat1')

        // Beat 2 — headline word reveal (SplitText)
        tl.addLabel('beat2')
        if (headlineRef.current) {
          const split = new SplitText(headlineRef.current, { type: 'words' })
          tl.from(split.words, { opacity: 0, y: 12, stagger: 0.04, duration: 0.6 }, 'beat2')
        }

        // Beat 3 — stat cards stagger
        tl.addLabel('beat3')
          .from('#cin-cards > *', { scale: 0.92, opacity: 0, stagger: 0.06, duration: 0.4 }, 'beat3')

        // Beat 4 — number roll-ups
        tl.addLabel('beat4')
        const counters: { id: string; target: number; fmt: (n: number) => string }[] = [
          { id: '#cin-val-commits', target: payload.total_commits,    fmt: n => n.toLocaleString() },
          { id: '#cin-val-repos',   target: payload.repos_touched,    fmt: n => String(n) },
          { id: '#cin-val-lines',   target: payload.lines_added_total, fmt: formatLines },
          { id: '#cin-val-prs',     target: payload.prs_merged_total,  fmt: n => String(n) },
        ]
        counters.forEach(({ id, target, fmt }) => {
          const el  = rootRef.current!.querySelector(id)
          if (!el) return
          const obj = { val: 0 }
          tl.to(obj, {
            val:      target,
            duration: 0.8,
            ease:     'expo.out',
            onUpdate: () => { el.textContent = fmt(Math.round(obj.val)) },
          }, 'beat4')
        })

        // Beat 5 — MoM delta fade in (only if delta element exists)
        tl.addLabel('beat5')
        if (commitsDelta !== null) {
          tl.from('#cin-delta', { opacity: 0, duration: 0.2 }, 'beat5')
        } else {
          // no delta element — add empty beat so snap labels stay aligned
          tl.to({}, { duration: 0.1 }, 'beat5')
        }

        // Beat 6 — chart bars rise
        tl.addLabel('beat6')
          .from('#cin-chart [data-bar]', {
            scaleY:          0,
            transformOrigin: 'bottom',
            stagger:         0.02,
            duration:        0.5,
            ease:            'power4.out',
          }, 'beat6')

        // Beat 7 — AI summary character reveal
        tl.addLabel('beat7')
        if (summaryRef.current) {
          const splitSummary = new SplitText(summaryRef.current, { type: 'chars' })
          tl.from(splitSummary.chars, { opacity: 0, stagger: 0.018, duration: 0.01 }, 'beat7')
        }

        // Beat 8 — ProfileCard slide up
        tl.addLabel('beat8')
          .from('#cin-card', { y: 40, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' }, 'beat8')

        // Beat 9 — Share CTA pulse
        tl.addLabel('beat9')
          .from('#cin-cta', { opacity: 0, duration: 0.2 }, 'beat9')
          .to('#cin-cta', { scale: 1.03, duration: 0.3, yoyo: true, repeat: 1 }, 'beat9+=0.2')

        // Panning for overflow content
        if (contentRef.current) {
          const overflow = Math.max(0, contentRef.current.scrollHeight - window.innerHeight + 80)
          if (overflow > 0) {
            tl.to(contentRef.current, { y: -overflow, duration: 2.5, ease: 'power1.inOut' }, 'beat4')
          }
        }

      }, rootRef)
    }

    void runSequence()

    return () => {
      isCancelled = true
      gsapCtx?.revert()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const profileStatus = `${payload.total_commits.toLocaleString()} commits · ${payload.longest_streak}d streak`

  return (
    <div
      ref={rootRef}
      className="min-h-screen"
      style={{ background: '#0D1117', overflow: 'hidden' }}
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-start py-16 px-6 gap-12 w-full"
      >
        {/* Beat 1 — avatar badge + persona chip */}
        <div id="cin-badge" className="flex flex-col items-center gap-2">
        <img
          src={avatarUrl}
          alt={user.displayName ?? user.username}
          className="w-16 h-16 rounded-full"
          style={{ border: `3px solid ${meta.color}55` }}
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="font-mono text-[12px]" style={{ color: '#8B949E' }}>
          @{user.username}
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: meta.bg, border: `1px solid ${meta.color}44` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          <span className="font-mono text-[11px] font-medium" style={{ color: meta.color }}>
            {payload.developer_persona}
          </span>
        </div>
      </div>

      {/* Beat 2 — headline */}
      <h1
        ref={headlineRef}
        className="font-display font-bold text-center"
        style={{ fontSize: 'clamp(28px, 5vw, 48px)', color: '#E6EDF3', lineHeight: 1.1 }}
      >
        Your {formatPeriod(period)}, in numbers
      </h1>

      {/* Beat 3 + 4 + 5 — stat cards */}
      <div
        id="cin-cards"
        className="grid grid-cols-2 gap-4 w-full max-w-xl lg:grid-cols-4"
      >
        {[
          { id: 'cin-val-commits', label: 'Commits',     accent: '#58A6FF', showDelta: true },
          { id: 'cin-val-repos',   label: 'Repos',       accent: '#3FB950', showDelta: false },
          { id: 'cin-val-lines',   label: 'Lines Added', accent: '#E3B341', showDelta: false },
          { id: 'cin-val-prs',     label: 'PRs Merged',  accent: '#BC8CFF', showDelta: false },
        ].map(card => (
          <div
            key={card.id}
            className="relative rounded-[2rem] p-5 flex flex-col gap-3 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
          >
            <div
              className="absolute top-0 left-5 right-5 h-[2px] rounded-full"
              style={{ background: `${card.accent}33` }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: '#484F58' }}
            >
              {card.label}
            </span>
            <span
              id={card.id}
              className="font-display font-bold"
              style={{ fontSize: '2.5rem', lineHeight: 1, color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}
            >
              0
            </span>
            {card.showDelta && commitsDelta !== null && (
              <div
                id="cin-delta"
                className="font-mono text-[11px]"
                style={{ opacity: 0, color: commitsDelta >= 0 ? '#3FB950' : '#F85149' }}
              >
                {commitsDelta >= 0 ? '+' : ''}{commitsDelta}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Beat 6 — commit bar chart */}
      <div
        id="cin-chart"
        className="w-full max-w-xl rounded-[2rem] p-5 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
      >
        <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
          Daily Commits — {monthName} {year}
        </div>
        <div
          className="flex items-end gap-[3px]"
          style={{ height: 80 }}
          role="img"
          aria-label={`Daily commit frequency for ${monthName} ${year}`}
        >
          {payload.daily_commits.map((count, i) => {
            const heightPct = count === 0 ? 4 : Math.max(8, (count / max) * 100)
            return (
              <div
                key={i}
                data-bar
                className="flex-1 rounded-[2px] min-w-[6px]"
                style={{ height: `${heightPct}%`, background: barColor(count, max), transformOrigin: 'bottom' }}
                title={`Day ${i + 1}: ${count} commit${count !== 1 ? 's' : ''}`}
              />
            )
          })}
        </div>
      </div>

      {/* Beat 7 — AI summary */}
      {narrative && (
        <div
          className="w-full max-w-xl rounded-[2rem] p-6 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]"
        >
          <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
            {monthName} Summary
          </div>
          <p
            ref={summaryRef}
            className="font-mono text-[13px] leading-relaxed"
            style={{ color: '#8B949E' }}
          >
            {narrative}
          </p>
        </div>
      )}

      {/* Beat 8 — ProfileCard */}
      <div id="cin-card">
        <ProfileCard
          name={user.displayName ?? user.username}
          title={payload.developer_persona}
          handle={user.username}
          status={profileStatus}
          avatarUrl={avatarUrl}
          contactText="Share Report"
          showUserInfo={true}
          enableTilt={true}
          behindGlowEnabled={true}
        />
      </div>

      {/* Beat 9 — Share CTA */}
      <div id="cin-cta">
        <a
          href={`/u/${user.username}/${period}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-8 py-4 rounded-xl font-mono text-[14px] font-medium transition-all duration-150"
          style={{ background: '#58A6FF', color: '#0D1117', textDecoration: 'none' }}
        >
          Share your {monthName} report →
        </a>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <Lock size={11} weight="thin" color="#484F58" />
          <span className="font-mono text-[11px]" style={{ color: '#484F58' }}>
            Public activity only
          </span>
        </div>
      </div>
    </div>
    </div>
  )
}
