import type { HabitatClass, PredictionSummary, ReportDraft } from '@/types/report'

function pickLabel(draft: ReportDraft): HabitatClass {
  const notes = draft.notes?.toLowerCase() ?? ''
  const photoName = draft.photoEvidence?.name.toLowerCase() ?? ''
  const evidenceText = `${notes} ${photoName}`

  if (evidenceText.includes('drain') || evidenceText.includes('inlet')) {
    return 'drain_inlet'
  }

  if (evidenceText.includes('tire') || evidenceText.includes('tyre')) {
    return 'tire'
  }

  return 'artificial_container'
}

export function predictHabitatForDraft(draft: ReportDraft): PredictionSummary {
  const label = pickLabel(draft)
  const confidenceBand =
    label === 'drain_inlet'
      ? 'moderate'
      : label === 'tire'
        ? 'high'
        : 'moderate'

  return {
    label,
    confidenceBand,
    advisoryText:
      'Advisory only. Officers still review the image, location, and hotspot context before any action is recorded.',
  }
}
