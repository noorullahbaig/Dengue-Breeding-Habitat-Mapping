import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReportsService } from '@/services/contracts'
import { AppApiError } from '@/services/apiServices'
import type { LocationPoint, ReportDraft, ReportPrecheck } from '@/types/report'

export type PrecheckStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseReportPrecheckOptions {
  enabled: boolean
  requestKey: string
  draft: ReportDraft
  correctedLocation: LocationPoint
  reportsService: ReportsService
  timeoutMs?: number
}

interface UseReportPrecheckResult {
  status: PrecheckStatus
  isLoading: boolean
  precheck: ReportPrecheck | null
  error: AppApiError | null
  retry: () => void
}

const DEFAULT_TIMEOUT_MS = 45_000

function timeoutError(timeoutMs: number) {
  return new AppApiError({
    kind: 'timeout',
    message: `AI pre-check timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
    transport: 'network',
  })
}

export function useReportPrecheck({
  enabled,
  requestKey,
  draft,
  correctedLocation,
  reportsService,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseReportPrecheckOptions): UseReportPrecheckResult {
  const [state, setState] = useState<{
    status: PrecheckStatus
    precheck: ReportPrecheck | null
    error: AppApiError | null
  }>({ status: 'idle', precheck: null, error: null })
  const [retryNonce, setRetryNonce] = useState(0)
  const inputRef = useRef({ draft, correctedLocation, reportsService })
  inputRef.current = { draft, correctedLocation, reportsService }

  const retry = useCallback(() => {
    setRetryNonce((value) => value + 1)
  }, [])
  const requestToken = requestKey ? `${requestKey}:${retryNonce}` : ''

  useEffect(() => {
    if (!requestToken) {
      setState({ status: 'idle', precheck: null, error: null })
      return
    }

    if (!enabled) {
      return
    }

    const controller = new AbortController()
    let mounted = true
    let timeoutHandle: number | undefined

    setState({ status: 'loading', precheck: null, error: null })

    const request = inputRef.current.reportsService.precheckReport(
      {
        ...inputRef.current.draft,
        correctedLocation: inputRef.current.correctedLocation,
      },
      { signal: controller.signal },
    )
    const deadline = new Promise<ReportPrecheck>((_, reject) => {
      timeoutHandle = window.setTimeout(() => {
        controller.abort()
        reject(timeoutError(timeoutMs))
      }, timeoutMs)
    })

    Promise.race([request, deadline])
      .then((result) => {
        if (mounted) {
          setState({ status: 'success', precheck: result, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!mounted || controller.signal.aborted && error?.constructor?.name === 'AbortError') {
          return
        }

        const normalizedError =
          error instanceof AppApiError
            ? error
            : new AppApiError({
                kind: 'server_error',
                message: error instanceof Error ? error.message : String(error),
                transport: 'http',
              })
        setState({ status: 'error', precheck: null, error: normalizedError })
      })
      .finally(() => {
        if (timeoutHandle !== undefined) {
          window.clearTimeout(timeoutHandle)
        }
      })

    return () => {
      mounted = false
      controller.abort()
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [enabled, requestToken, timeoutMs])

  return {
    ...state,
    isLoading: state.status === 'loading',
    retry,
  }
}
