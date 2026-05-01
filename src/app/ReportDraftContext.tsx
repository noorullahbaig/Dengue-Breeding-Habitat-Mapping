import {
  useState,
  type PropsWithChildren,
} from 'react'
import { LAST_REFERENCE_KEY } from '@/lib/constants'
import { ReportDraftContext } from '@/app/reportDraftStore'
import type { ReportDraft } from '@/types/report'

export function ReportDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<ReportDraft>({})
  const [lastSubmittedReference, setLastSubmittedReferenceState] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.sessionStorage.getItem(LAST_REFERENCE_KEY) ?? ''
  })

  function updateDraft(updates: Partial<ReportDraft>) {
    setDraft((current) => ({
      ...current,
      ...updates,
    }))
  }

  function resetDraft() {
    setDraft({})
  }

  function setLastSubmittedReference(reference: string) {
    setLastSubmittedReferenceState(reference)
    window.sessionStorage.setItem(LAST_REFERENCE_KEY, reference)
  }

  return (
    <ReportDraftContext.Provider
      value={{
        draft,
        updateDraft,
        resetDraft,
        lastSubmittedReference,
        setLastSubmittedReference,
      }}
    >
      {children}
    </ReportDraftContext.Provider>
  )
}
