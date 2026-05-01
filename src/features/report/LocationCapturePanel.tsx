import { useState } from 'react'
import { InlineNotice } from '@/components/InlineNotice'
import { KL_CENTER } from '@/lib/constants'
import { formatCoordinate } from '@/lib/formatters'
import { getGeolocationFallbackMessage, requestCurrentPosition } from '@/lib/geolocation'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'
import type { LocationPoint } from '@/types/report'

interface LocationCapturePanelProps {
  location?: LocationPoint | null
  onLocationChange: (location: LocationPoint) => void
}

export function LocationCapturePanel({
  location,
  onLocationChange,
}: LocationCapturePanelProps) {
  const [statusMessage, setStatusMessage] = useState(
    'Use your current location or continue with the demo Kuala Lumpur location.',
  )
  const [isLocating, setIsLocating] = useState(false)
  const locationIsOutsideServiceArea = location ? !isWithinServiceArea(location) : false

  async function handleLocate() {
    setIsLocating(true)
    setStatusMessage('Requesting current location...')

    try {
      const nextLocation = await requestCurrentPosition()
      onLocationChange(nextLocation)
      setStatusMessage(
        isWithinServiceArea(nextLocation)
          ? 'Location captured. You can still drag the map pin before submitting.'
          : 'Location captured outside Kuala Lumpur.',
      )
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : getGeolocationFallbackMessage(),
      )
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <section className="panel">
      <div className="stack-md">
        <div className="cluster-row">
          <button
            type="button"
            className="button"
            onClick={handleLocate}
            disabled={isLocating}
          >
            Use my current location
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              onLocationChange(KL_CENTER)
              setStatusMessage(
                'Demo Kuala Lumpur location loaded. Drag the map pin on the next screen to correct it.',
              )
            }}
          >
            Use demo Kuala Lumpur location
          </button>
        </div>

        <InlineNotice>{statusMessage}</InlineNotice>

        {locationIsOutsideServiceArea ? (
          <InlineNotice tone="warning">
            {SERVICE_AREA_ERROR} Use a location inside Kuala Lumpur to continue.
          </InlineNotice>
        ) : null}

        {location ? (
          <div className="detail-grid">
            <div>
              <span className="detail-grid__label">Latitude</span>
              <strong>{formatCoordinate(location.latitude)}</strong>
            </div>
            <div>
              <span className="detail-grid__label">Longitude</span>
              <strong>{formatCoordinate(location.longitude)}</strong>
            </div>
            <div>
              <span className="detail-grid__label">Source</span>
              <strong>{location.source}</strong>
            </div>
            <div>
              <span className="detail-grid__label">Accuracy</span>
              <strong>
                {location.accuracyMeters
                  ? `${Math.round(location.accuracyMeters)} m`
                  : 'Adjusted later'}
              </strong>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
