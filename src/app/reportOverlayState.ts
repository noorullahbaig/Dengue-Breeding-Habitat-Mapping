import type { Location } from 'react-router-dom'
import type { ReportDraft } from '@/types/report'

export interface ReportRouteState {
  reportBackgroundLocation?: Location
  reportTriggerId?: string
  promptForDraft?: boolean
}

export function hasReportDraft(draft: ReportDraft) {
  return Boolean(
    draft.photoFile ||
      draft.photoPreviewUrl ||
      draft.photoEvidence ||
      draft.detectedLocation ||
      draft.correctedLocation ||
      draft.notes,
  )
}
