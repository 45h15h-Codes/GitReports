/**
 * DashboardSkeleton — loading shimmer layout while report data is fetching.
 * Matches the grid structure of the full dashboard to prevent layout shift.
 */

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-8 min-h-screen animate-pulse bg-[#090909]">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded" style={{ background: 'var(--border-default)' }} />
          <div className="h-8 w-48 rounded" style={{ background: 'var(--border-default)' }} />
        </div>
        <div className="h-9 w-32 rounded" style={{ background: 'var(--border-default)' }} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 380px' }}>
        <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
      </div>
    </div>
  )
}
