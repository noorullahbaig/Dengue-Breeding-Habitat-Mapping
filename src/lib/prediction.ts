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
  const confidence = label === 'tire' ? 0.84 : label === 'drain_inlet' ? 0.62 : 0.62
  const thresholds = {
    artificial_container: 0.674,
    drain_inlet: 0.553,
    tire: 0.712,
    unclassified: 1,
  } as const
  const confidenceBand = confidence >= thresholds[label] ? 'high' : 'low'
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
      confidenceBand === 'high'
        ? 'The model produced stronger evidence for this habitat class, but final verification is still required.'
        : 'The model produced uncertain evidence; human verification is required.',
  }
}
