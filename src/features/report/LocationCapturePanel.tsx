import { useState } from 'react'
import { InlineNotice } from '@/components/InlineNotice'
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
    'Use your current location as a starting point, then move the report pin to the exact site.',
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
          ? 'Approximate location found. Use it as a guide, then confirm the exact pin on the map.'
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
        </div>

        <InlineNotice>{statusMessage}</InlineNotice>

        {locationIsOutsideServiceArea ? (
          <InlineNotice tone="warning">
            {SERVICE_AREA_ERROR} Use a location inside Kuala Lumpur to continue.
          </InlineNotice>
        ) : null}
      </div>
    </section>
  )
}
