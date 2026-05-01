import { useContext } from 'react'
import { ReportDraftContext } from '@/app/reportDraftStore'

export function useReportDraft() {
  const value = useContext(ReportDraftContext)

  if (!value) {
    throw new Error('useReportDraft must be used within ReportDraftProvider.')
  }

  return value
}
