import { useState } from 'react'
import { Button } from '@/components/ui'
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
    <div className="location-capture-glass">
      <div className="location-capture-glass__content">
        <Button
          variant="secondary"
          className="button--small"
          onClick={handleLocate}
          disabled={isLocating}
        >
          {isLocating ? 'Locating...' : 'Use my current location'}
        </Button>
        <span className="location-capture-glass__status">{statusMessage}</span>
      </div>

      {locationIsOutsideServiceArea ? (
        <div className="location-capture-glass__warning">
          {SERVICE_AREA_ERROR} Use a location inside Kuala Lumpur to continue.
        </div>
      ) : null}
    </div>
  )
}
