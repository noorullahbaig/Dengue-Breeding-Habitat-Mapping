import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { queryPermissionState, watchPermissionState, type PermissionQueryState } from '@/lib/permissions'
import { requestCurrentPosition } from '@/lib/geolocation'
import { PermissionBlocker } from './PermissionBlocker'
import type { LocationPoint } from '@/types/report'

interface LocationPermissionGateProps {
  /**
   * Called when a device location is successfully obtained.
   * Parent is responsible for storing the result.
   */
  onLocationObtained: (location: LocationPoint) => void
  /**
   * Rendered when the permission is granted and a position has been fetched
   * (or is being fetched). Children receive `isLocating` so they can show a
   * loading ring, and `onRetryLocation` so they can offer a "Refresh" button.
   */
  children: (props: { isLocating: boolean; onRetryLocation: () => void; locationError: string }) => React.ReactNode
}

/**
 * Gates geolocation access for the location step.
 *
 * Three states:
 *  - querying:  Silently checking permission — shows a loading placeholder
 *  - priming:   Permission not yet asked ('prompt') — shows an explanation before
 *               triggering the real browser prompt
 *  - blocked:   Permission permanently denied — shows PermissionBlocker with
 *               browser-specific settings instructions
 *  - ready:     Permission granted — renders `children`, auto-fetches location
 */
export function LocationPermissionGate({ onLocationObtained, children }: LocationPermissionGateProps) {
  const [phase, setPhase] = useState<'querying' | 'priming' | 'blocked' | 'ready'>('querying')
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false)

  const fetchLocation = useCallback(async () => {
    setIsLocating(true)
    setHasFetchedOnce(true)
    setLocationError('')
    try {
      const position = await requestCurrentPosition()
      onLocationObtained(position)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Location access failed.'
      // GeolocationPositionError carries a `code` property; PERMISSION_DENIED === 1
      const isPermissionDenied =
        (typeof err === 'object' && err !== null && 'code' in err && err.code === 1) ||
        (err instanceof Error && err.message.toLowerCase().includes('blocked'))
      if (isPermissionDenied) {
        setPhase('blocked')
        return
      }
      setLocationError(msg)
    } finally {
      setIsLocating(false)
    }
  }, [onLocationObtained])

  async function checkAndTransition() {
    const state = await queryPermissionState('geolocation')

    if (state === 'granted') {
      setPhase('ready')
      return
    }
    if (state === 'denied') {
      setPhase('blocked')
      return
    }
    // 'prompt' or 'unsupported' — show priming UI
    setPhase('priming')
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only run on mount
  useEffect(() => {
    void checkAndTransition()

    const cleanup = watchPermissionState('geolocation', (newState: PermissionQueryState) => {
      if (newState === 'granted') {
        setPhase('ready')
      } else if (newState === 'denied') {
        setPhase('blocked')
      }
    })

    return cleanup
  }, [])

  // Auto-fetch location the first time we reach the 'ready' phase
  useEffect(() => {
    if (phase === 'ready' && !hasFetchedOnce && !isLocating) {
      void fetchLocation()
    }
  }, [phase, hasFetchedOnce, isLocating, fetchLocation])

  async function handleRetry() {
    setLocationError('')
    await checkAndTransition()
  }

  async function handleShareLocation() {
    // Trigger the real browser prompt by calling getCurrentPosition
    await fetchLocation()
    // Re-check state after the attempt (handles the case where the user allowed)
    await checkAndTransition()
  }

  if (phase === 'querying') {
    return (
      <div className="permission-gate-skeleton">
        <div className="permission-gate-skeleton__bar" />
        <div className="permission-gate-skeleton__bar permission-gate-skeleton__bar--short" />
      </div>
    )
  }

  if (phase === 'blocked') {
    return <PermissionBlocker permission="location" onRetry={handleRetry} />
  }

  if (phase === 'priming') {
    return (
      <div className="permission-priming">
        <div className="permission-priming__icon-wrap">
          <svg
            aria-hidden="true"
            className="permission-priming__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="9" r="3" />
          </svg>
        </div>
        <h2 className="permission-priming__heading">Location required to verify this site</h2>
        <p className="permission-priming__body">
          Your device GPS location is used to verify that you are physically standing at the
          reported site. The pin on the map can be refined within a short radius of your actual
          position — this prevents false or remote submissions.
        </p>
        <div className="permission-priming__requirement">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Your selected exact pin is published only after you consent
        </div>
        {locationError && (
          <p className="permission-priming__error">{locationError}</p>
        )}
        <Button
          variant="primary"
          className="permission-priming__cta"
          onClick={handleShareLocation}
          disabled={isLocating}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="17"
            height="17"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
          {isLocating ? 'Requesting location…' : 'Share My Location'}
        </Button>
      </div>
    )
  }

  // phase === 'ready'
  return (
    <>
      {children({
        isLocating,
        onRetryLocation: fetchLocation,
        locationError,
      })}
    </>
  )
}
