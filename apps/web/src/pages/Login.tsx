import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lightning, GithubLogo } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import gsap from 'gsap'

export function Login() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const authError = params.get('auth_error')

  const rightPanelRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Already authenticated → go to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  // GSAP Cinematic Entrance & Motion
  useEffect(() => {
    // Subtle infinite zoom on the background image
    if (imageRef.current) {
      gsap.to(imageRef.current, {
        scale: 1.05,
        duration: 20,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      })
    }

    // Stagger text and CTA entry
    gsap.fromTo('.login-stagger > *',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out", delay: 0.2 }
    )
  }, [])

  const errorMessage: Record<string, string> = {
    denied: 'GitHub access was denied. Please try again.',
    server: 'Something went wrong during authentication. Please try again.',
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-[var(--canvas)] text-[var(--text-primary)]">
      
      {/* LEFT: AUTH PANEL */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 relative z-10">
        
        {/* Navigation / Logo */}
        <div className="absolute top-8 left-8 md:top-12 md:left-12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--surface-1)] border border-[var(--border-default)]">
            <Lightning size={18} weight="fill" className="text-[var(--text-primary)]" />
          </div>
          <span className="font-display font-medium tracking-tight text-lg">gitreport</span>
        </div>

        <div className="login-stagger max-w-md mt-16 md:mt-0">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium tracking-tighter leading-[1.1] mb-6">
            Your GitHub story,<br />
            automated.
          </h1>
          
          <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed max-w-[40ch]">
            Connect your repositories and let our narrative engine analyze your impact. No manual updates required.
          </p>

          {authError && (
            <div 
              className="mb-8 p-4 rounded-xl text-sm font-mono"
              style={{
                background: '#2D1010',
                border: '1px solid #F8514933',
                color: '#F85149',
              }}
              role="alert"
            >
              {errorMessage[authError] ?? 'Authentication failed. Please try again.'}
            </div>
          )}

          <button
            onClick={login}
            disabled={isLoading}
            className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-medium text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <GithubLogo size={22} weight="fill" />
            <span>{isLoading ? 'Checking session…' : 'Continue with GitHub'}</span>
          </button>
          
          <p className="mt-8 text-xs text-[var(--text-tertiary)] max-w-[35ch] leading-relaxed">
            By continuing, you allow GitReport to read your public repository metrics safely.
          </p>
        </div>
      </div>

      {/* RIGHT: CINEMATIC MEDIA (Hidden on Mobile) */}
      <div className="hidden md:block w-1/2 relative overflow-hidden" ref={rightPanelRef}>
        {/* Darkening edge gradients */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[var(--canvas)] via-transparent to-transparent opacity-100" />
        <div className="absolute inset-0 z-10 bg-gradient-to-tr from-[var(--canvas)] via-[var(--canvas)]/20 to-transparent opacity-80" />
        
        {/* Violet Spotlight Wash */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#6a4cf5] opacity-20 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 z-10 pointer-events-none" />
        
        {/* Cinematic Background Image */}
        <img 
          ref={imageRef}
          src="https://picsum.photos/seed/gitreport/1920/1080" 
          alt=""
          className="absolute inset-0 w-full h-full object-cover grayscale mix-blend-luminosity contrast-125 opacity-50"
        />
        
        {/* Liquid Glass Refraction Component */}
        <div className="absolute bottom-12 right-12 z-20 p-6 rounded-[2rem] bg-white/5 border border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl max-w-sm login-stagger">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-black/50 overflow-hidden border border-white/10 flex-shrink-0">
              <img src="https://picsum.photos/seed/dev/100/100" alt="" className="w-full h-full object-cover opacity-80" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Monthly Digest Ready</p>
              <p className="text-white/50 text-xs font-mono mt-0.5">Report #42 generated</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-white/80 rounded-full" />
            </div>
            <div className="h-1.5 w-4/5 bg-white/10 rounded-full" />
            <div className="h-1.5 w-2/3 bg-white/10 rounded-full" />
          </div>
        </div>
      </div>

    </div>
  )
}
