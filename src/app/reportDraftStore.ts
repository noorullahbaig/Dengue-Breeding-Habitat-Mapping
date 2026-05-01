import { createContext } from 'react'
import type { ReportDraft } from '@/types/report'

export interface ReportDraftContextValue {
  draft: ReportDraft
  updateDraft: (updates: Partial<ReportDraft>) => void
  resetDraft: () => void
  lastSubmittedReference: string
  setLastSubmittedReference: (reference: string) => void
}

export const ReportDraftContext = createContext<ReportDraftContextValue | null>(null)
