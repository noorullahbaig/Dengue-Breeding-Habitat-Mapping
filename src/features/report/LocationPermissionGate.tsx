import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import {
  getLocationFailureMessage,
  requestCurrentLocation,
  type LocationFailureReason,
} from '@/lib/geolocation'
import { PermissionBlocker } from './PermissionBlocker'
import type { LocationPoint } from '@/types/report'

interface LocationPermissionGateProps {
  onLocationObtained: (location: LocationPoint) => void
  children: (props: {
    isLocating: boolean
    onRetryLocation: () => void
    locationError: string
  }) => React.ReactNode
}

type LocationGatePhase = 'consent' | 'locating' | 'ready' | 'blocked' | 'failed'

/**
 * Requests verification-grade location only after an explicit user action.
 * The real Geolocation API result is authoritative; permission preflight state
 * is intentionally excluded because Safari can report `prompt` after denial.
 */
export function LocationPermissionGate({
  onLocationObtained,
  children,
}: LocationPermissionGateProps) {
  const [phase, setPhase] = useState<LocationGatePhase>('consent')
  const [failureReason, setFailureReason] = useState<LocationFailureReason | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const mountedRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeRequestRef.current = null
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (activeRequestRef.current !== null) return

    const requestId = ++requestSequenceRef.current
    activeRequestRef.current = requestId
    setFailureReason(null)
    setIsLocating(true)
    setPhase((currentPhase) => currentPhase === 'ready' ? 'ready' : 'locating')

    const handleUnexpectedFailure = () => {
      if (!mountedRef.current || activeRequestRef.current !== requestId) return

      activeRequestRef.current = null
      setIsLocating(false)
      setFailureReason('unavailable')
      setPhase('failed')
    }

    let locationRequest: ReturnType<typeof requestCurrentLocation>
    try {
      locationRequest = requestCurrentLocation({ mode: 'verification' })
    } catch {
      handleUnexpectedFailure()
      return
    }

    void locationRequest.then((result) => {
      if (!mountedRef.current || activeRequestRef.current !== requestId) return

      activeRequestRef.current = null
      setIsLocating(false)

      if (result.ok === true) {
        setPhase('ready')
        onLocationObtained(result.location)
        return
      }

      setFailureReason(result.reason)
      setPhase(result.reason === 'denied' ? 'blocked' : 'failed')
    }).catch(handleUnexpectedFailure)
  }, [onLocationObtained])

  if (phase === 'blocked') {
    return (
      <div className="permission-blocker-scroll">
        <PermissionBlocker permission="location" onRetry={requestLocation} />
      </div>
    )
  }

  if (phase === 'ready') {
    return (
      <>
        {children({
          isLocating,
          onRetryLocation: requestLocation,
          locationError: failureReason ? getLocationFailureMessage(failureReason) : '',
        })}
      </>
    )
  }

  const failureMessage = failureReason
    ? getLocationFailureMessage(failureReason)
    : ''

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
      <h2 className="permission-priming__heading">
        {phase === 'failed' ? 'Location could not be obtained' : 'Location required to verify this site'}
      </h2>
      <p className="permission-priming__body">
        Your device location verifies that you are physically standing at the reported site. The
        pin can be refined only within a short radius of the detected position.
      </p>
      <div className="permission-priming__requirement">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="14"
          height="14"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Your selected exact pin is published only after you consent
      </div>
      {failureMessage ? (
        <p className="permission-priming__error" role="alert">
          {failureMessage}
        </p>
      ) : null}
      <Button
        variant="primary"
        className="permission-priming__cta"
        onClick={requestLocation}
        disabled={isLocating}
        aria-busy={isLocating}
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
        {isLocating ? 'Finding location…' : phase === 'failed' ? 'Try Again' : 'Share My Location'}
      </Button>
    </div>
  )
}
