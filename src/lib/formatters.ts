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

export function formatHabitatLabel(habitatClass: HabitatClass) {
  return habitatLabels[habitatClass]
}

export function formatStatusLabel(status: SubmissionStatus) {
  return statusLabels[status]
}

export function formatConfidenceLabel(confidence: ConfidenceBand) {
  return confidenceLabels[confidence]
}

export function formatTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoTimestamp))
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
