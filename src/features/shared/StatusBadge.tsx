import { formatStatusLabel } from '@/lib/formatters'
import type { SubmissionStatus } from '@/types/report'

interface StatusBadgeProps {
  status: SubmissionStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{formatStatusLabel(status)}</span>
}
