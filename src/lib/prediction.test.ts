import { describe, expect, it } from 'vitest'
import { formatConfidenceLabel } from '@/lib/formatters'
import { predictHabitatForDraft } from '@/lib/prediction'
import { seededReports } from '@/mocks/data'
import type { ReportDraft } from '@/types/report'


function draftWithNotes(notes: string): ReportDraft {
  return { notes }
}


describe('model-matched mock operating profile', () => {
  it('keeps artificial-container mock evidence in the uncertain band below 0.674', () => {
    const prediction = predictHabitatForDraft(draftWithNotes('plastic container'))

    expect(prediction.label).toBe('artificial_container')
    expect(prediction.confidence).toBe(0.62)
    expect(prediction.confidenceBand).toBe('low')
    expect(prediction.advisoryText).toBe(
      'The model produced uncertain evidence; human verification is required.',
    )
  })

  it('places drain and tire mock evidence in their stronger bands', () => {
    const drain = predictHabitatForDraft(draftWithNotes('drain inlet'))
    const tire = predictHabitatForDraft(draftWithNotes('discarded tire'))

    expect(drain.confidence).toBe(0.62)
    expect(drain.confidenceBand).toBe('high')
    expect(tire.confidence).toBe(0.84)
    expect(tire.confidenceBand).toBe('high')
    expect(drain.advisoryText).toBe(
      'The model produced stronger evidence for this habitat class, but final verification is still required.',
    )
  })

  it('keeps seeded confidence bands consistent with the locked stronger thresholds', () => {
    const thresholds = {
      artificial_container: 0.674,
      drain_inlet: 0.553,
      tire: 0.712,
      unclassified: 1,
    } as const

    for (const report of seededReports) {
      const expectedBand =
        (report.prediction.confidence ?? 0) >= thresholds[report.prediction.label]
          ? 'high'
          : 'low'
      expect(report.prediction.confidenceBand).toBe(expectedBand)
    }
  })

  it('preserves stored band labels because historical reports have no model provenance', () => {
    expect(formatConfidenceLabel('low')).toBe('Low confidence')
    expect(formatConfidenceLabel('moderate')).toBe('Moderate confidence')
    expect(formatConfidenceLabel('high')).toBe('Higher confidence')
  })
})
