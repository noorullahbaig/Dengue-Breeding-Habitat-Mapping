export const reportSteps = [
  {
    title: 'Take image',
    description: 'Add a clear image of the breeding habitat.',
  },
  {
    title: 'Confirm location',
    description: 'Move the pin to the exact site.',
  },
  {
    title: 'Consent form',
    description: 'Review and accept public consent.',
  },
  {
    title: 'AI inference results',
    description: 'See the model advisory.',
  },
  {
    title: 'Report confirmation',
    description: 'Send the final evidence bundle.',
  },
] as const

export interface ReportStepState {
  photoReady: boolean
  pinReady: boolean
  detailsReady: boolean
  precheckReady: boolean
  needsStackDecision: boolean
}

export function canOpenReportStep(stepIndex: number, state: ReportStepState) {
  if (stepIndex === 0) return true
  if (stepIndex === 1) return state.photoReady
  if (stepIndex === 2) return state.photoReady && state.pinReady
  if (stepIndex === 3) return state.photoReady && state.pinReady && state.detailsReady

  return (
    state.photoReady &&
    state.pinReady &&
    state.detailsReady &&
    state.precheckReady &&
    !state.needsStackDecision
  )
}

export function getReportStepBlockedReason(
  stepIndex: number,
  state: ReportStepState,
) {
  if (canOpenReportStep(stepIndex, state)) return ''
  if (stepIndex === 1) return 'Upload or capture a photo first.'
  if (stepIndex === 2) return 'Confirm the report map pin location first.'
  if (stepIndex === 3) return 'Accept privacy consent first.'
  if (!state.detailsReady) return 'Accept privacy consent first.'
  if (!state.precheckReady) return 'Run the AI classification check first.'
  if (state.needsStackDecision) return 'Make a stacking duplication decision.'
  return 'Complete the previous step first.'
}

export function isReportStepComplete(
  stepIndex: number,
  state: ReportStepState,
) {
  if (stepIndex === 0) return state.photoReady
  if (stepIndex === 1) return state.pinReady
  if (stepIndex === 2) return state.detailsReady
  if (stepIndex === 3) return state.precheckReady
  return false
}
