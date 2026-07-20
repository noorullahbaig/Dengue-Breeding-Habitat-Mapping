import { act, renderHook } from '@testing-library/react'
import type { UserLocationFix } from '@/app/PublicMapSessionContext'
import type { LocationRequestResult } from '@/lib/geolocation'
import { usePublicMapLocation } from '@/pages/components/usePublicMapLocation'

const locationHarness = vi.hoisted(() => ({
  permissionCallback: undefined as ((state: 'granted' | 'prompt' | 'denied' | 'unsupported') => void) | undefined,
  requestCurrentLocation: vi.fn<() => Promise<LocationRequestResult>>(),
  stopWatching: vi.fn(),
}))

vi.mock('@/lib/permissions', () => ({
  watchPermissionState: (
    _name: 'geolocation',
    callback: (state: 'granted' | 'prompt' | 'denied' | 'unsupported') => void,
  ) => {
    locationHarness.permissionCallback = callback
    return locationHarness.stopWatching
  },
}))

vi.mock('@/lib/geolocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/geolocation')>()
  return {
    ...actual,
    requestCurrentLocation: () => locationHarness.requestCurrentLocation(),
  }
})

const browserLocation = {
  latitude: 3.139,
  longitude: 101.6869,
  accuracyMeters: 20,
  source: 'browser' as const,
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

describe('usePublicMapLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T00:00:00Z'))
    setVisibility('visible')
    locationHarness.permissionCallback = undefined
    locationHarness.requestCurrentLocation.mockReset()
    locationHarness.stopWatching.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('automatically requests only after permission is already granted without recentering', async () => {
    locationHarness.requestCurrentLocation.mockResolvedValue({
      ok: true,
      location: browserLocation,
    })
    const onFixChange = vi.fn()
    const onRecenter = vi.fn()
    renderHook(() => usePublicMapLocation({ onFixChange, onRecenter }))

    act(() => locationHarness.permissionCallback?.('prompt'))
    expect(locationHarness.requestCurrentLocation).not.toHaveBeenCalled()

    await act(async () => {
      locationHarness.permissionCallback?.('granted')
      await Promise.resolve()
    })
    expect(onFixChange).toHaveBeenCalledWith({
      location: browserLocation,
      obtainedAt: Date.now(),
    })
    expect(onRecenter).not.toHaveBeenCalled()
  })

  it('refreshes a granted visible fix after sixty seconds and pauses while hidden', async () => {
    const currentFix: UserLocationFix = {
      location: browserLocation,
      obtainedAt: Date.now(),
    }
    locationHarness.requestCurrentLocation.mockResolvedValue({
      ok: true,
      location: { ...browserLocation, latitude: 3.14 },
    })
    const onFixChange = vi.fn()
    renderHook(() => usePublicMapLocation({ currentFix, onFixChange, onRecenter: vi.fn() }))
    act(() => locationHarness.permissionCallback?.('granted'))

    setVisibility('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(locationHarness.requestCurrentLocation).not.toHaveBeenCalled()

    setVisibility('visible')
    await act(async () => {
      locationHarness.permissionCallback?.('granted')
      await Promise.resolve()
    })
    expect(locationHarness.requestCurrentLocation).toHaveBeenCalledOnce()
    expect(onFixChange).toHaveBeenCalledWith(expect.objectContaining({
      location: expect.objectContaining({ latitude: 3.14 }),
    }))
  })

  it('hides a fix older than two minutes and clears it when permission is denied', async () => {
    const currentFix: UserLocationFix = {
      location: browserLocation,
      obtainedAt: Date.now() - 120_001,
    }
    locationHarness.requestCurrentLocation.mockReturnValue(new Promise(() => {}))
    const onFixChange = vi.fn()
    renderHook(() => usePublicMapLocation({ currentFix, onFixChange, onRecenter: vi.fn() }))

    act(() => locationHarness.permissionCallback?.('granted'))
    expect(onFixChange).toHaveBeenCalledWith(undefined)

    onFixChange.mockClear()
    act(() => locationHarness.permissionCallback?.('denied'))
    expect(onFixChange).toHaveBeenCalledWith(undefined)
  })

  it('manually refreshes, recenters, deduplicates taps, and surfaces failures', async () => {
    let resolveRequest: (result: LocationRequestResult) => void = () => {}
    locationHarness.requestCurrentLocation.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve
    }))
    const onFixChange = vi.fn()
    const onRecenter = vi.fn()
    const { result } = renderHook(() => usePublicMapLocation({ onFixChange, onRecenter }))

    act(() => {
      void result.current.locate()
      void result.current.locate()
    })
    expect(locationHarness.requestCurrentLocation).toHaveBeenCalledOnce()
    expect(result.current.isLocating).toBe(true)

    await act(async () => {
      resolveRequest({ ok: true, location: browserLocation })
    })
    expect(onFixChange).toHaveBeenCalledWith({
      location: browserLocation,
      obtainedAt: Date.now(),
    })
    expect(onRecenter).toHaveBeenCalledWith([3.139, 101.6869])

    locationHarness.requestCurrentLocation.mockResolvedValueOnce({
      ok: false,
      reason: 'denied',
      browserCode: 1,
    })
    await act(async () => {
      await result.current.locate()
    })
    expect(result.current.error).toContain('Location access is blocked')
  })
})
