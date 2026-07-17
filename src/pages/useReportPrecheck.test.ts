import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReportsService } from '@/services/contracts'
import { useReportPrecheck } from '@/pages/useReportPrecheck'

function createService() {
  return {
    precheckReport: vi.fn(),
  } as unknown as ReportsService & {
    precheckReport: ReturnType<typeof vi.fn>
  }
}

const baseOptions = {
  enabled: true,
  requestKey: 'photo-1:3.13900:101.68690',
  draft: {
    photoFile: new File(['photo'], 'evidence.jpg', { type: 'image/jpeg' }),
  },
  correctedLocation: {
    latitude: 3.139,
    longitude: 101.6869,
    source: 'browser' as const,
  },
}

describe('useReportPrecheck', () => {
  it('does not rerun when unrelated draft state changes', async () => {
    const reportsService = createService()
    reportsService.precheckReport.mockResolvedValue({
      prediction: {
        label: 'tire',
        confidence: 0.9,
        confidenceBand: 'high',
        topRawLabel: 'Tire',
        detections: [],
        advisoryText: 'Advisory only.',
      },
      candidates: [],
      imageUrl: null,
    })

    const { rerender } = renderHook(
      ({ draft }) =>
        useReportPrecheck({
          ...baseOptions,
          draft,
          reportsService,
        }),
      { initialProps: { draft: baseOptions.draft } },
    )

    await waitFor(() => expect(reportsService.precheckReport).toHaveBeenCalledTimes(1))

    rerender({
      draft: {
        ...baseOptions.draft,
        wizardStep: 3,
      },
    })

    expect(reportsService.precheckReport).toHaveBeenCalledTimes(1)
  })

  it('returns a timeout error and exits loading when the request stalls', async () => {
    vi.useFakeTimers()
    const reportsService = createService()
    reportsService.precheckReport.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() =>
      useReportPrecheck({
        ...baseOptions,
        reportsService,
        timeoutMs: 100,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error?.kind).toBe('timeout')
    vi.useRealTimers()
  })

  it('aborts the previous request when the photo or location changes', async () => {
    const reportsService = createService()
    reportsService.precheckReport.mockImplementation(
      (_draft: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )

    const { rerender } = renderHook(
      ({ requestKey }) =>
        useReportPrecheck({
          ...baseOptions,
          requestKey,
          reportsService,
        }),
      { initialProps: { requestKey: baseOptions.requestKey } },
    )

    await waitFor(() => expect(reportsService.precheckReport).toHaveBeenCalledTimes(1))
    const firstSignal = reportsService.precheckReport.mock.calls[0][1].signal

    rerender({ requestKey: 'photo-2:3.13900:101.68690' })

    expect(firstSignal.aborted).toBe(true)
    expect(reportsService.precheckReport).toHaveBeenCalledTimes(2)
  })
})
