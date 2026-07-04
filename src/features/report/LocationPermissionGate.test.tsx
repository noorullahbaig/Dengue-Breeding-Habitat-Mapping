import { render, screen, waitFor } from '@testing-library/react'
import { LocationPermissionGate } from '@/features/report/LocationPermissionGate'

const queryPermissionState = vi.fn()
const watchPermissionState = vi.fn(() => vi.fn())
const requestCurrentPosition = vi.fn()

vi.mock('@/lib/permissions', () => ({
  queryPermissionState: (...args: unknown[]) => queryPermissionState(...args),
  watchPermissionState: (...args: unknown[]) => watchPermissionState(...args),
}))

vi.mock('@/lib/geolocation', () => ({
  requestCurrentPosition: (...args: unknown[]) => requestCurrentPosition(...args),
}))

describe('LocationPermissionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    watchPermissionState.mockReturnValue(vi.fn())
  })

  it('explains that the selected exact pin is public only after consent', async () => {
    queryPermissionState.mockResolvedValue('prompt')

    render(
      <LocationPermissionGate onLocationObtained={vi.fn()}>
        {() => <div>Location map</div>}
      </LocationPermissionGate>,
    )

    expect(await screen.findByText('Your selected exact pin is published only after you consent')).toBeInTheDocument()
    expect(screen.queryByText('Your exact coordinates are never shared publicly')).not.toBeInTheDocument()
  })

  it('fetches a granted location and then renders the location review', async () => {
    const location = {
      latitude: 3.139,
      longitude: 101.6869,
      accuracyMeters: 20,
      source: 'browser' as const,
    }
    const onLocationObtained = vi.fn()
    queryPermissionState.mockResolvedValue('granted')
    requestCurrentPosition.mockResolvedValue(location)

    render(
      <LocationPermissionGate onLocationObtained={onLocationObtained}>
        {() => <div>Location map</div>}
      </LocationPermissionGate>,
    )

    expect(await screen.findByText('Location map')).toBeInTheDocument()
    await waitFor(() => expect(onLocationObtained).toHaveBeenCalledWith(location))
  })
})
