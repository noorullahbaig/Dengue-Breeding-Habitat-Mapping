import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LocationReviewMap } from '@/features/report/LocationReviewMap'
import { KL_CENTER } from '@/lib/constants'

const leafletMocks = vi.hoisted(() => ({
  markerProps: [] as Array<{
    eventHandlers?: {
      dragend?: (event: {
        target: {
          getLatLng: () => { lat: number; lng: number }
          setLatLng: (position: [number, number]) => void
        }
      }) => void
    }
    children?: ReactNode
  }>,
  setView: vi.fn(),
}))

vi.mock('react-leaflet', () => ({
  Circle: () => <div data-testid="accuracy-circle" />,
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Marker: (props: (typeof leafletMocks.markerProps)[number]) => {
    leafletMocks.markerProps.push(props)
    return <div data-testid="report-marker">{props.children}</div>
  },
  Polygon: ({ children }: { children: ReactNode }) => (
    <div data-testid="service-area-polygon">{children}</div>
  ),
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  useMap: () => ({ setView: leafletMocks.setView }),
}))

function latestMarkerProps() {
  const props = leafletMocks.markerProps.at(-1)
  if (!props) {
    throw new Error('Marker was not rendered.')
  }

  return props
}

describe('LocationReviewMap', () => {
  beforeEach(() => {
    leafletMocks.markerProps = []
    leafletMocks.setView.mockClear()
  })

  it('rejects outside-Kuala-Lumpur pin drags and resets the marker', () => {
    const onLocationChange = vi.fn()
    const setLatLng = vi.fn()

    render(<LocationReviewMap location={KL_CENTER} onLocationChange={onLocationChange} />)

    act(() => {
      latestMarkerProps().eventHandlers?.dragend?.({
        target: {
          getLatLng: () => ({ lat: 2.9264, lng: 101.6964 }),
          setLatLng,
        },
      })
    })

    expect(onLocationChange).not.toHaveBeenCalled()
    expect(setLatLng).toHaveBeenCalledWith([KL_CENTER.latitude, KL_CENTER.longitude])
    expect(
      screen.getByText(/the pin was returned to the last valid location/i),
    ).toBeInTheDocument()
  })

  it('accepts valid Kuala Lumpur pin drags and clears the warning', () => {
    const onLocationChange = vi.fn()
    const setLatLng = vi.fn()

    render(<LocationReviewMap location={KL_CENTER} onLocationChange={onLocationChange} />)

    act(() => {
      latestMarkerProps().eventHandlers?.dragend?.({
        target: {
          getLatLng: () => ({ lat: 2.9264, lng: 101.6964 }),
          setLatLng,
        },
      })
    })
    expect(screen.getByText(/the pin was returned/i)).toBeInTheDocument()

    act(() => {
      latestMarkerProps().eventHandlers?.dragend?.({
        target: {
          getLatLng: () => ({ lat: 3.14, lng: 101.6875 }),
          setLatLng,
        },
      })
    })

    expect(onLocationChange).toHaveBeenCalledWith({
      latitude: 3.14,
      longitude: 101.6875,
      accuracyMeters: undefined,
      source: 'manual',
    })
    expect(screen.queryByText(/the pin was returned/i)).not.toBeInTheDocument()
  })
})
