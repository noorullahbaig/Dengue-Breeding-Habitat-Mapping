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
  const photoName = draft.photoEvidence?.name.toLowerCase() ?? ''
  const confidenceBand =
    label === 'drain_inlet'
      ? 'moderate'
      : label === 'tire'
        ? 'high'
        : 'moderate'
  const confidence = confidenceBand === 'high' ? 0.84 : 0.62
  const rawLabel =
    label === 'drain_inlet'
      ? 'Drain-Inlet'
      : label === 'tire'
        ? 'Tire'
        : 'Bottle'

  return {
    label,
    confidence,
    confidenceBand,
    topRawLabel: rawLabel,
    detections: photoName.includes('empty') ? [] : [
      {
        rawLabel,
        confidence,
        bbox: [48, 44, 260, 220],
        bboxNormalized: [0.15, 0.18, 0.81, 0.92],
        imageWidth: 320,
        imageHeight: 240,
      },
    ],
    advisoryText:
      'Advisory only. Officers still review the image, location, and hotspot context before any action is recorded.',
  }
}
