import {
  useCallback,
  useMemo,
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

  const updateDraft = useCallback((updates: Partial<ReportDraft>) => {
    setDraft((current) => ({
      ...current,
      ...updates,
    }))
  }, [])

  const resetDraft = useCallback(() => {
    setDraft({})
  }, [])

  const setLastSubmittedReference = useCallback((reference: string) => {
    setLastSubmittedReferenceState(reference)
    window.sessionStorage.setItem(LAST_REFERENCE_KEY, reference)
  }, [])

  const contextValue = useMemo(
    () => ({
      draft,
      updateDraft,
      resetDraft,
      lastSubmittedReference,
      setLastSubmittedReference,
    }),
    [draft, lastSubmittedReference, resetDraft, setLastSubmittedReference, updateDraft],
  )

  return (
    <ReportDraftContext.Provider value={contextValue}>
      {children}
    </ReportDraftContext.Provider>
  )
}
