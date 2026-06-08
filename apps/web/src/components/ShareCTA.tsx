interface ShareCTAProps {
  variant: 'inline' | 'sticky'
}

const GH_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

export function ShareCTA({ variant }: ShareCTAProps) {
  function handleClick() {
    // Sprint 9: replace with real GitHub OAuth redirect
    alert('GitHub OAuth — wired in Sprint 9')
  }

  if (variant === 'sticky') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center p-4"
        style={{
          background: '#0D1117EE',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #21262D',
        }}
      >
        <button
          id="share-cta-sticky"
          onClick={handleClick}
          className="flex items-center gap-3 px-6 py-3 rounded-xl font-mono text-[13px] font-medium cursor-pointer transition-all duration-150"
          style={{
            background: '#58A6FF',
            color: '#0D1117',
            border: 'none',
            width: '100%',
            maxWidth: 400,
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#79B8FF' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#58A6FF' }}
        >
          {GH_ICON}
          Connect with GitHub to generate your report
        </button>
      </div>
    )
  }

  // inline variant — above fold
  return (
    <button
      id="share-cta-inline"
      onClick={handleClick}
      className="flex items-center gap-3 px-6 py-3 rounded-xl font-mono text-[13px] font-medium cursor-pointer transition-all duration-150"
      style={{
        background: '#58A6FF',
        color: '#0D1117',
        border: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#79B8FF' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#58A6FF' }}
    >
      {GH_ICON}
      Connect with GitHub to generate your report
    </button>
  )
}
