import { Navigate } from 'react-router-dom'
import { useAuth }   from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0D1117' }}
        aria-label="Loading..."
      >
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo mark */}
          <div
            className="w-8 h-8 rounded-md animate-pulse"
            style={{ background: '#58A6FF22', border: '1px solid #58A6FF33' }}
          />
          <span className="font-mono text-[12px]" style={{ color: '#484F58' }}>
            Loading…
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
