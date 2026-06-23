import { formatStatusLabel } from '@/lib/formatters'
import type { SubmissionStatus } from '@/types/report'
import { Badge } from '@/components/ui'

interface StatusBadgeProps {
  status: SubmissionStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = status === 'prioritized'
    ? 'danger'
    : status === 'action_recorded' || status === 'closed'
      ? 'success'
      : 'info'

  return (
    <Badge tone={tone} className={`status-badge status-badge--${status}`}>
      {formatStatusLabel(status)}
    </Badge>
  )
}
