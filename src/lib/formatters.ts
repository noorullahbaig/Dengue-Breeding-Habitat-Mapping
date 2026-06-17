import type { ConfidenceBand, HabitatClass, SubmissionStatus } from '@/types/report'

const habitatLabels: Record<HabitatClass, string> = {
  tire: 'Tire',
  drain_inlet: 'Drain / Drain Inlet',
  artificial_container: 'Artificial Container',
  unclassified: 'Unclassified',
}

const statusLabels: Record<SubmissionStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  prioritized: 'Prioritized',
  action_recorded: 'Action Recorded',
  closed: 'Closed',
}

const confidenceLabels: Record<ConfidenceBand, string> = {
  low: 'Low confidence',
  moderate: 'Moderate confidence',
  high: 'Higher confidence',
}

export function formatHabitatLabel(habitatClass: string) {
  return habitatLabels[habitatClass as HabitatClass] ?? habitatClass
}

export function formatStatusLabel(status: SubmissionStatus) {
  return statusLabels[status]
}

export function formatConfidenceLabel(confidence: ConfidenceBand) {
  return confidenceLabels[confidence]
}

export function formatConfidenceScore(confidence?: number | null) {
  if (typeof confidence !== 'number') {
    return 'Not enough evidence'
  }

  return `${Math.round(confidence * 100)}%`
}

export function formatDetectionCount(count = 0) {
  return count === 1 ? '1 detection' : `${count} detections`
}

export function formatTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoTimestamp))
}

/**
 * Returns a compact relative time string such as "just now", "3h ago", "2 days ago".
 * Ideal for activity feed cards where space is constrained.
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now()
  const then = new Date(isoTimestamp).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function formatCalendarDate(isoTimestamp: string) {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
  }).format(new Date(isoTimestamp))
}

export function formatCompactCalendarDate(isoTimestamp: string) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoTimestamp))
}

export function formatCoordinate(value: number) {
  return value.toFixed(5)
}
