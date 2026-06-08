interface SocialShareProps {
  caption: string
  url:     string
}

export function SocialShare({ caption, url }: SocialShareProps) {
  const encoded     = encodeURIComponent(`${caption}\n${url}`)
  const xUrl        = `https://x.com/intent/tweet?text=${encoded}`
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

  const linkStyle = {
    background:     '#1C2128',
    color:          '#8B949E',
    border:         '1px solid #30363D',
    textDecoration: 'none' as const,
  }
  const hoverIn  = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.currentTarget.style.background = '#21262D'
    e.currentTarget.style.color      = '#E6EDF3'
  }
  const hoverOut = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.currentTarget.style.background = '#1C2128'
    e.currentTarget.style.color      = '#8B949E'
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[11px]" style={{ color: '#484F58' }}>Share on</span>

      {/* X / Twitter */}
      <a
        id="social-share-x"
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-all duration-150"
        style={linkStyle}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        aria-label="Share on X"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        X
      </a>

      {/* LinkedIn */}
      <a
        id="social-share-linkedin"
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-all duration-150"
        style={linkStyle}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        aria-label="Share on LinkedIn"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        LinkedIn
      </a>

      {/* Copy link */}
      <button
        id="social-share-copy"
        onClick={() => navigator.clipboard.writeText(url)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] font-medium transition-all duration-150 cursor-pointer"
        style={{ background: '#1C2128', color: '#8B949E', border: '1px solid #30363D' }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
      </button>
    </div>
  )
}
