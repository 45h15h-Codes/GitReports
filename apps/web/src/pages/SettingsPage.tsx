import { useState, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '../context/AuthContext'
import { logout } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Database, GitBranch, Trash2 } from 'lucide-react'

gsap.registerPlugin(useGSAP)

export function SettingsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
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

  useGSAP(() => {
    gsap.from('.gsap-animate', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'all'
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="flex flex-col gap-8 p-6 md:p-12 min-h-screen bg-[#090909] text-white selection:bg-[#0099ff] selection:text-white">
      {/* Header */}
      <div className="gsap-animate flex flex-col gap-2 border-b border-white/5 pb-8">
        <div className="text-[13px] font-medium text-[#888888] uppercase tracking-[0.2em]">
          Preferences
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-none text-white">
          Settings
        </h1>
      </div>

      <div className="grid gap-5 max-w-3xl">
        {/* Account section */}
        <div className="gsap-animate rounded-[24px] p-6 md:p-8 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight text-white mb-6">
            <GitBranch size={20} /> Account
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-semibold text-white">
                {user?.displayName ?? user?.username}
              </div>
              <div className="text-[13px] text-[#888888]">
                Signed in via GitHub · @{user?.username}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center justify-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-full bg-[#222222] text-white transition-all duration-150 hover:bg-[#333333] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
            >
              <LogOut size={14} />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>

        {/* Privacy section */}
        <div className="gsap-animate rounded-[24px] p-6 md:p-8 bg-[#141414] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight text-white mb-6">
            <Shield size={20} /> Privacy
          </div>
          <div className="flex flex-col gap-4">
            {[
              'Reports only use your public GitHub activity.',
              'Private repository names, commit messages, and code are never processed.',
              'Your email is only used to send report-ready notifications.',
              'You can delete your account and all data at any time.',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-[#0099ff] shadow-[0_0_8px_rgba(0,153,255,0.5)]" />
                <span className="text-[14px] text-[#888888] leading-relaxed">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="gsap-animate rounded-[24px] p-6 md:p-8 bg-[#141111] shadow-[inset_0_0_0_1px_rgba(255,68,68,0.1)] border border-[#ff4444]/10 bg-gradient-to-b from-[#141414] to-[#1a0a0a]">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight text-[#ff4444] mb-4">
            <Database size={20} /> Danger Zone
          </div>
          <p className="text-[14px] text-[#888888] leading-relaxed mb-6 max-w-xl">
            To request deletion of your account and all associated data, email us or use the button below.
            Your data will be permanently deleted within 30 days per our privacy policy.
          </p>
          <button
            className="flex items-center justify-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-full bg-[#ff4444]/10 text-[#ff4444] transition-all duration-150 hover:bg-[#ff4444]/20 active:scale-95 shadow-[inset_0_0_0_1px_rgba(255,68,68,0.2)] w-fit"
            onClick={() => window.open('mailto:support@gitreport.dev?subject=Account Deletion Request', '_blank')}
          >
            <Trash2 size={14} /> Request Account Deletion
          </button>
        </div>
      </div>
    </div>
  )
}
