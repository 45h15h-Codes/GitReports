/**
 * NoReportsState — empty state shown when the authenticated user has no reports.
 * Prompts user to generate their first report.
 */

import { GitCommit } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { GenerateReportButton } from './GenerateReportButton'

export function NoReportsState() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center justify-center flex-1 gap-6 mt-24">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
        >
          <GitCommit size={28} weight="duotone" style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="text-center">
          <h1
            className="font-display font-bold text-[24px] mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            No reports yet
            {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="font-mono text-[13px] mb-6" style={{ color: 'var(--text-secondary)' }}>
            Generate your first monthly developer report from your GitHub activity.
          </p>
          <GenerateReportButton variant="primary" />
        </div>
      </div>
    </div>
  )
}
