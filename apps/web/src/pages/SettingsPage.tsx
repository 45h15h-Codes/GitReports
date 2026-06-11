import { useState }    from 'react'
import { useAuth }     from '../context/AuthContext'
import { logout }      from '../lib/api'
import { useNavigate } from 'react-router-dom'

export function SettingsPage() {
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: '#0D1117' }}>

      <div>
        <div
          className="font-mono text-[11px] font-medium uppercase tracking-widest mb-1"
          style={{ color: '#484F58', letterSpacing: '0.1em' }}
        >
          Preferences
        </div>
        <h1
          className="font-display font-bold text-[28px] leading-tight"
          style={{ color: '#E6EDF3' }}
        >
          Settings
        </h1>
      </div>

      {/* Account section */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
          Account
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[13px]" style={{ color: '#E6EDF3' }}>
              {user?.displayName ?? user?.username}
            </div>
            <div className="font-mono text-[11px] mt-0.5" style={{ color: '#8B949E' }}>
              Signed in via GitHub · @{user?.username}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="font-mono text-[12px] px-4 py-2 rounded-lg cursor-pointer transition-all duration-150"
            style={{
              background: '#2D1010',
              color:      '#F85149',
              border:     '1px solid #F8514933',
              opacity:    loggingOut ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.background = '#3D1515' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2D1010' }}
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Privacy section */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
          Privacy
        </div>
        <div className="flex flex-col gap-3">
          {[
            'Reports only use your public GitHub activity.',
            'Private repository names, commit messages, and code are never processed.',
            'Your email is only used to send report-ready notifications.',
            'You can delete your account and all data at any time.',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: '#3FB950' }}
              />
              <span className="font-mono text-[12px] leading-relaxed" style={{ color: '#8B949E' }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data section */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#161B22', border: '1px solid #21262D' }}
      >
        <div className="font-mono text-[11px] uppercase tracking-widest mb-4" style={{ color: '#484F58' }}>
          Your Data
        </div>
        <p className="font-mono text-[12px] leading-relaxed mb-4" style={{ color: '#8B949E' }}>
          To request deletion of your account and all associated data, email us or use the button below.
          Your data will be permanently deleted within 30 days per our privacy policy.
        </p>
        <button
          className="font-mono text-[12px] px-4 py-2 rounded-lg cursor-pointer transition-all duration-150"
          style={{
            background: 'transparent',
            color:      '#484F58',
            border:     '1px solid #21262D',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color  = '#F85149'
            e.currentTarget.style.border = '1px solid #F8514933'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color  = '#484F58'
            e.currentTarget.style.border = '1px solid #21262D'
          }}
          onClick={() => window.open('mailto:support@gitreport.dev?subject=Account Deletion Request', '_blank')}
        >
          Request account deletion
        </button>
      </div>
    </div>
  )
}
