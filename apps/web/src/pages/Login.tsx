import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lightning }  from '@phosphor-icons/react'
import { useAuth }    from '../context/AuthContext'

export function Login() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const authError    = params.get('auth_error')

  // Already authenticated → go to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const errorMessage: Record<string, string> = {
    denied: 'GitHub access was denied. Please try again.',
    server: 'Something went wrong during authentication. Please try again.',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0D1117' }}
    >
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#58A6FF' }}
          >
            <Lightning size={18} weight="fill" color="#0D1117" />
          </div>
          <span
            className="font-display font-bold text-[22px]"
            style={{ color: '#E6EDF3' }}
          >
            GitReport
          </span>
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1
            className="font-display font-bold text-[28px] leading-tight mb-2"
            style={{ color: '#E6EDF3' }}
          >
            Your GitHub story,<br />told monthly.
          </h1>
          <p className="font-mono text-[13px]" style={{ color: '#8B949E' }}>
            Connect GitHub to generate your developer report.
          </p>
        </div>

        {/* Error state */}
        {authError && (
          <div
            className="w-full px-4 py-3 rounded-lg font-mono text-[12px]"
            style={{
              background: '#2D1010',
              border:     '1px solid #F8514933',
              color:      '#F85149',
            }}
            role="alert"
          >
            {errorMessage[authError] ?? 'Authentication failed. Please try again.'}
          </div>
        )}

        {/* GitHub CTA */}
        <button
          id="login-github-btn"
          onClick={login}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-mono text-[13px] font-medium transition-all duration-150"
          style={{
            background: isLoading ? '#1C2128' : '#21262D',
            color:      isLoading ? '#484F58' : '#E6EDF3',
            border:     '1px solid #30363D',
            cursor:     isLoading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.background   = '#30363D'
              e.currentTarget.style.borderColor  = '#58A6FF44'
            }
          }}
          onMouseLeave={e => {
            if (!isLoading) {
              e.currentTarget.style.background   = '#21262D'
              e.currentTarget.style.borderColor  = '#30363D'
            }
          }}
        >
          {/* GitHub mark */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          {isLoading ? 'Checking session…' : 'Continue with GitHub'}
        </button>

        <p className="font-mono text-[11px] text-center" style={{ color: '#484F58' }}>
          GitReport only reads public activity by default.<br />
          Private repo analysis requires repo scope.
        </p>
      </div>
    </div>
  )
}
