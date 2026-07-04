import {
  canOpenReportStep,
  getReportStepBlockedReason,
  isReportStepComplete,
  reportSteps,
  type ReportStepState,
} from '@/pages/reportWizard'

function createState(overrides: Partial<ReportStepState> = {}): ReportStepState {
  return {
    photoReady: false,
    pinReady: false,
    detailsReady: false,
    precheckReady: false,
    needsStackDecision: false,
    ...overrides,
  }
}

describe('report wizard step rules', () => {
  it('locks AI review until privacy consent is accepted', () => {
    const state = createState({
      photoReady: true,
      pinReady: true,
      detailsReady: false,
    })

    expect(canOpenReportStep(3, state)).toBe(false)
    expect(getReportStepBlockedReason(3, state)).toBe('Accept privacy consent first.')
  })

  it('locks submit until the AI pre-check has completed', () => {
    const state = createState({
      photoReady: true,
      pinReady: true,
      detailsReady: true,
      precheckReady: false,
    })

    expect(canOpenReportStep(4, state)).toBe(false)
    expect(getReportStepBlockedReason(4, state)).toBe('Run the AI classification check first.')
  })

  it('locks submit until a duplicate decision has been made', () => {
    const state = createState({
      photoReady: true,
      pinReady: true,
      detailsReady: true,
      precheckReady: true,
      needsStackDecision: true,
    })

    expect(canOpenReportStep(4, state)).toBe(false)
    expect(getReportStepBlockedReason(4, state)).toBe('Make a stacking duplication decision.')
  })

  it('marks each step complete only when its own requirement has been satisfied', () => {
    const state = createState({
      photoReady: true,
      pinReady: true,
      detailsReady: true,
      precheckReady: false,
    })

    expect(isReportStepComplete(0, state)).toBe(true)
    expect(isReportStepComplete(1, state)).toBe(true)
    expect(isReportStepComplete(2, state)).toBe(true)
    expect(isReportStepComplete(3, state)).toBe(false)
    expect(isReportStepComplete(4, state)).toBe(false)
  })

  it('keeps the canonical five-step order intact', () => {
    expect(reportSteps.map((step) => step.title)).toEqual([
      'Take image',
      'Confirm location',
      'Consent form',
      'AI inference results',
      'Report confirmation',
    ])
  })
})
