import { Link, useLocation }    from 'react-router-dom'
import {
  ChartBar, GitBranch, Trophy, User,
  ShareNetwork, Gear, Lightning, SignOut,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  icon:  React.ReactNode
  label: string
  to:    string
}

const NAV_ITEMS: NavItem[] = [
  { icon: <ChartBar    size={18} weight="duotone" />, label: 'Dashboard',    to: '/'             },
  { icon: <GitBranch   size={18} weight="duotone" />, label: 'Reports',      to: '/reports'      },
  { icon: <Trophy      size={18} weight="duotone" />, label: 'Achievements', to: '/achievements' },
  { icon: <User        size={18} weight="duotone" />, label: 'Profile',      to: '/profile'      },
  { icon: <ShareNetwork size={18} weight="duotone" />, label: 'Share',       to: '/share'        },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const location         = useLocation()

  const displayName = user?.displayName ?? user?.username ?? '…'
  const handle      = user?.username ?? '…'
  const avatarUrl   = user?.avatarUrl ?? `https://ui-avatars.com/api/?name=${handle}&background=1C2128&color=8B949E`

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] flex flex-col z-20"
      style={{ background: '#161B22', borderRight: '1px solid #21262D' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid #21262D' }}>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: '#58A6FF' }}
        >
          <Lightning size={15} weight="fill" color="#0D1117" />
        </div>
        <span
          className="font-display text-[15px] font-bold tracking-tight"
          style={{ color: '#E6EDF3' }}
        >
          GitReport
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(item => {
          const isActive = item.to === '/' 
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)
          
          return (
            <Link
              key={item.label}
              to={item.to}
              id={`nav-${item.label.toLowerCase()}`}
              className="sidebar-nav-link w-full flex items-center gap-3 px-3 py-2 rounded-md font-mono text-[13px] font-medium transition-colors duration-150"
              style={{
                background:     isActive ? '#1F3450' : 'transparent',
                color:          isActive ? '#58A6FF' : '#8B949E',
                textDecoration: 'none',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom — settings + user pill */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid #21262D' }}>
        <Link
          to="/settings"
          id="nav-settings"
          className="sidebar-action-btn w-full flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 font-mono text-[13px] font-medium"
          style={{ 
            color: location.pathname.startsWith('/settings') ? '#58A6FF' : '#8B949E', 
            background: location.pathname.startsWith('/settings') ? '#1F3450' : 'transparent', 
            border: 'none',
            textDecoration: 'none'
          }}
        >
          <Gear size={18} weight="duotone" />
          <span>Settings</span>
        </Link>

        {/* User pill */}
        <div
          className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-md"
          style={{ background: '#1C2128' }}
        >
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
            className="w-7 h-7 rounded-full"
            style={{ border: '1px solid #30363D' }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[12px] font-medium truncate" style={{ color: '#E6EDF3' }}>
              {displayName}
            </div>
            <div className="font-mono text-[10px] truncate" style={{ color: '#8B949E' }}>
              @{handle}
            </div>
          </div>
          {/* Logout */}
          <button
            id="logout-btn"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="sidebar-logout-btn flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#484F58' }}
          >
            <SignOut size={14} weight="duotone" />
          </button>
        </div>
      </div>
    </aside>
  )
}
