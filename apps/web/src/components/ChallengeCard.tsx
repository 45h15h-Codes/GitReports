import { motion } from 'framer-motion'
import { Lock } from '@phosphor-icons/react'
import type { AiPayload, DeveloperProfile } from '../types/api'
import { PERSONA_META } from '../utils/persona'

interface FilledProps {
  state:   'filled'
  payload: AiPayload
  profile: DeveloperProfile
  label:   string
}

interface BlankProps {
  state:    'blank'
  label:    string
  onAccept: () => void
}

type ChallengeCardProps = FilledProps | BlankProps

export function ChallengeCard(props: ChallengeCardProps) {
  if (props.state === 'blank') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl overflow-hidden flex flex-col items-center justify-center"
        style={{
          width:       300,
          minHeight:   380,
          background:  '#161B22',
          border:      '1px dashed #30363D',
        }}
      >
        <Lock size={28} weight="thin" color="#484F58" style={{ marginBottom: 16 }} />
        <div
          className="font-display font-bold text-[18px] mb-2"
          style={{ color: '#484F58' }}
        >
          {props.label}
        </div>
        <div
          className="font-mono text-[12px] mb-6 text-center px-8"
          style={{ color: '#484F58' }}
        >
          Connect GitHub to reveal your stats
        </div>
        <button
          id="challenge-accept-btn"
          onClick={props.onAccept}
          className="px-5 py-2.5 rounded-xl font-mono text-[12px] font-medium cursor-pointer transition-all duration-150"
          style={{ background: '#58A6FF', color: '#0D1117', border: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#79B8FF' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#58A6FF' }}
        >
          Accept the challenge
        </button>
      </motion.div>
    )
  }

  // Filled state — challenger's public stats
  const { payload, profile, label } = props
  const meta    = PERSONA_META[payload.developer_persona]
  const topLang = Object.entries(payload.languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{ width: 300, background: '#161B22', border: `1px solid ${meta.color}33` }}
    >
      {/* Persona accent bar */}
      <div style={{ height: 3, background: meta.color }} />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#484F58' }}>
            {label}
          </div>
          <div className="font-mono text-[12px] font-medium mt-0.5" style={{ color: '#8B949E' }}>
            @{profile.username}
          </div>
        </div>
        <img
          src={profile.avatar_url ?? `https://ui-avatars.com/api/?name=${profile.username}&background=161B22&color=8B949E`}
          alt={`${profile.display_name ?? profile.username} avatar`}
          className="w-10 h-10 rounded-full"
          style={{ border: `2px solid ${meta.color}55` }}
        />
      </div>

      {/* Persona badge */}
      <div className="px-5 pb-4">
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

      <div style={{ height: 1, background: '#21262D', margin: '0 20px' }} />

      {/* Stats row */}
      <div className="grid grid-cols-3 px-5 py-4">
        {[
          { label: 'Commits', value: String(payload.total_commits) },
          { label: 'Streak',  value: `${payload.longest_streak}d`  },
          { label: 'Lang',    value: topLang                        },
        ].map(item => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="font-mono text-[10px]" style={{ color: '#484F58' }}>
              {item.label}
            </span>
            <span
              className="font-display font-bold text-[22px] leading-none"
              style={{ color: '#E6EDF3', fontVariantNumeric: 'tabular-nums' }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: '#21262D', margin: '0 20px' }} />

      {/* Privacy footer — PRD §9.2 non-negotiable */}
      <div className="px-5 py-3 flex items-center gap-1.5">
        <Lock size={11} weight="thin" color="#484F58" />
        <span className="font-mono text-[10px]" style={{ color: '#484F58' }}>
          Public activity only
        </span>
      </div>
    </motion.div>
  )
}
