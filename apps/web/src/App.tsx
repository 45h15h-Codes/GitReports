import { useState, useEffect }           from 'react'
import { BrowserRouter, Routes, Route }  from 'react-router-dom'
import { Sun, Moon }                     from '@phosphor-icons/react'
import { AuthProvider }                  from './context/AuthContext'
import { ProtectedRoute }                from './components/ProtectedRoute'
import { Sidebar }                       from './components/Sidebar'
import { Dashboard }                     from './pages/Dashboard'
import { SharedReport }                  from './pages/SharedReport'
import { ChallengePage }                 from './pages/ChallengePage'
import { Login }                         from './pages/Login'
import './index.css'

// ── Theme hook — persisted in localStorage ────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('gr-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gr-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}

export default function App() {
  const { theme, toggle } = useTheme()

  return (
    <BrowserRouter>
      {/* AuthProvider inside BrowserRouter so it can useNavigate */}
      <AuthProvider>
        <Routes>
          {/* ── Public routes — no auth, no sidebar ─────────────────────── */}
          <Route path="/login"                          element={<Login />}         />
          <Route path="/u/:username/:period"            element={<SharedReport />}  />
          <Route path="/challenge/:username/:period"    element={<ChallengePage />} />

          {/* ── Authenticated app shell — sidebar + main ─────────────────── */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div
                  className="flex min-h-screen"
                  style={{ background: 'var(--bg-base)' }}
                >
                  <Sidebar />
                  <main className="flex-1 ml-[260px] overflow-x-hidden relative">
                    {/* Theme toggle — top-right corner */}
                    <button
                      id="theme-toggle"
                      onClick={toggle}
                      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                      className="fixed top-4 right-5 z-50 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
                      style={{
                        background: 'var(--bg-elevated)',
                        border:     '1px solid var(--border-default)',
                        color:      'var(--text-secondary)',
                        cursor:     'pointer',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
                        ;(e.currentTarget as HTMLButtonElement).style.color      = 'var(--text-primary)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
                        ;(e.currentTarget as HTMLButtonElement).style.color      = 'var(--text-secondary)'
                      }}
                    >
                      {theme === 'dark'
                        ? <Sun  size={15} weight="duotone" />
                        : <Moon size={15} weight="duotone" />}
                    </button>

                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
