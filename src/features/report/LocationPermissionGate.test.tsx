import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocationPermissionGate } from '@/features/report/LocationPermissionGate'
import type { LocationRequestResult } from '@/lib/geolocation'

const requestCurrentLocation = vi.fn<() => Promise<LocationRequestResult>>()

vi.mock('@/lib/geolocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/geolocation')>()
  return {
    ...actual,
    requestCurrentLocation: () => requestCurrentLocation(),
  }
})

const location = {
  latitude: 3.139,
  longitude: 101.6869,
  accuracyMeters: 20,
  source: 'browser' as const,
}

function renderGate(onLocationObtained = vi.fn()) {
  return render(
    <LocationPermissionGate onLocationObtained={onLocationObtained}>
      {({ isLocating, onRetryLocation, locationError }) => (
        <div>
          <span>Location map</span>
          <span>{locationError}</span>
          <button type="button" onClick={onRetryLocation} disabled={isLocating}>
            Refresh location
          </button>
        </div>
      )}
    </LocationPermissionGate>,
  )
}

describe('LocationPermissionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires an explicit tap before every initial location request', () => {
    renderGate()

    expect(screen.getByRole('button', { name: 'Share My Location' })).toBeEnabled()
    expect(requestCurrentLocation).not.toHaveBeenCalled()
  })

  it('shows immediate progress and prevents duplicate requests', async () => {
    let resolveRequest: (result: LocationRequestResult) => void = () => {}
    requestCurrentLocation.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    renderGate()

    const button = screen.getByRole('button', { name: 'Share My Location' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(requestCurrentLocation).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Finding location…' })).toBeDisabled()

    resolveRequest({ ok: true, location })
    expect(await screen.findByText('Location map')).toBeInTheDocument()
  })

  it('keeps a real denial blocked even when the Permissions API reports prompt', async () => {
    const permissionQuery = vi.fn().mockResolvedValue({ state: 'prompt' })
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: permissionQuery },
    })
    requestCurrentLocation.mockResolvedValue({
      ok: false,
      reason: 'denied',
      browserCode: 1,
    })
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))

    expect(await screen.findByRole('heading', { name: 'Location Access Blocked' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share My Location' })).not.toBeInTheDocument()
    expect(permissionQuery).not.toHaveBeenCalled()
  })

  it('performs a real request when retrying after Settings', async () => {
    const onLocationObtained = vi.fn()
    let resolveRetry: (result: LocationRequestResult) => void = () => {}
    requestCurrentLocation
      .mockResolvedValueOnce({ ok: false, reason: 'denied', browserCode: 1 })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve
        }),
      )
    renderGate(onLocationObtained)

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: "I've updated settings — Try Again",
      }),
    )

    await waitFor(() => expect(requestCurrentLocation).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Finding location…' })).toBeDisabled()
    resolveRetry({ ok: true, location })
    expect(await screen.findByText('Location map')).toBeInTheDocument()
    expect(onLocationObtained).toHaveBeenCalledWith(location)
  })

  it.each([
    ['timeout', "We couldn't get your location within 12 seconds."],
    ['unavailable', 'Your device could not determine its location.'],
    ['insecure-context', 'Location requires a secure HTTPS connection.'],
    ['policy-blocked', 'Location is blocked by the page or browser that opened this site.'],
    ['unsupported', 'This browser does not provide website location.'],
  ] as const)('shows an actionable, retryable %s failure', async (reason, message) => {
    requestCurrentLocation.mockResolvedValue({ ok: false, reason })
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))

    expect(await screen.findByText(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeEnabled()
  })

  it('recovers when the location request rejects unexpectedly', async () => {
    requestCurrentLocation.mockRejectedValueOnce(new Error('browser request failed'))
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))

    expect(await screen.findByRole('button', { name: 'Try Again' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Share My Location' })).not.toBeInTheDocument()
  })

  it('recovers when starting the location request throws synchronously', async () => {
    requestCurrentLocation.mockImplementationOnce(() => {
      throw new Error('browser request failed')
    })
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))

    expect(await screen.findByRole('button', { name: 'Try Again' })).toBeEnabled()
  })

  it('starts a fresh request after an unexpected rejection', async () => {
    requestCurrentLocation
      .mockRejectedValueOnce(new Error('browser request failed'))
      .mockResolvedValueOnce({ ok: true, location })
    const onLocationObtained = vi.fn()
    renderGate(onLocationObtained)

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }))

    expect(await screen.findByText('Location map')).toBeInTheDocument()
    expect(requestCurrentLocation).toHaveBeenCalledTimes(2)
    expect(onLocationObtained).toHaveBeenCalledWith(location)
  })

  it('ignores a location result after unmount', async () => {
    let resolveRequest: (result: LocationRequestResult) => void = () => {}
    requestCurrentLocation.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const onLocationObtained = vi.fn()
    const view = renderGate(onLocationObtained)

    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))
    view.unmount()
    resolveRequest({ ok: true, location })

    await Promise.resolve()
    expect(onLocationObtained).not.toHaveBeenCalled()
  })

  it('ignores a stale result from a gate that was unmounted and remounted', async () => {
    let resolveStaleRequest: (result: LocationRequestResult) => void = () => {}
    requestCurrentLocation
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStaleRequest = resolve
        }),
      )
      .mockResolvedValueOnce({ ok: true, location })

    const staleCallback = vi.fn()
    const first = renderGate(staleCallback)
    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))
    first.unmount()

    const currentCallback = vi.fn()
    renderGate(currentCallback)
    fireEvent.click(screen.getByRole('button', { name: 'Share My Location' }))
    expect(await screen.findByText('Location map')).toBeInTheDocument()

    resolveStaleRequest({ ok: true, location })
    await Promise.resolve()

    expect(staleCallback).not.toHaveBeenCalled()
    expect(currentCallback).toHaveBeenCalledOnce()
  })

  it('requires another explicit tap after remounting', () => {
    const first = renderGate()
    first.unmount()

    renderGate()

    expect(screen.getByRole('button', { name: 'Share My Location' })).toBeEnabled()
    expect(requestCurrentLocation).not.toHaveBeenCalled()
  })
})
