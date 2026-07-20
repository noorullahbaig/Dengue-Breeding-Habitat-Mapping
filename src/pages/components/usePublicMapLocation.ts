import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserLocationFix } from '@/app/PublicMapSessionContext'
import {
  getLocationFailureMessage,
  requestCurrentLocation,
} from '@/lib/geolocation'
import {
  watchPermissionState,
  type PermissionQueryState,
} from '@/lib/permissions'

export const MAP_LOCATION_REFRESH_MS = 60_000
export const MAP_LOCATION_EXPIRY_MS = 120_000

interface UsePublicMapLocationOptions {
  currentFix?: UserLocationFix
  onFixChange: (fix: UserLocationFix | undefined) => void
  onRecenter: (center: [number, number]) => void
}

export function usePublicMapLocation({
  currentFix,
  onFixChange,
  onRecenter,
}: UsePublicMapLocationOptions) {
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)
  const activeRequestRef = useRef<Promise<void> | null>(null)
  const permissionStateRef = useRef<PermissionQueryState>('unsupported')
  const fixRef = useRef(currentFix)
  const callbacksRef = useRef({ onFixChange, onRecenter })

  useEffect(() => {
    callbacksRef.current = { onFixChange, onRecenter }
  }, [onFixChange, onRecenter])

  useEffect(() => {
    fixRef.current = currentFix
  }, [currentFix])

  const publishFix = useCallback((fix: UserLocationFix | undefined) => {
    fixRef.current = fix
    callbacksRef.current.onFixChange(fix)
  }, [])

  const requestFix = useCallback((userInitiated: boolean) => {
    if (activeRequestRef.current) return activeRequestRef.current

    if (userInitiated) {
      setError('')
      setIsLocating(true)
    }

    const request = (async () => {
      try {
        const result = await requestCurrentLocation({ mode: 'map-centering' })
        if (!mountedRef.current) return

		if (result.ok === true) {
          const fix = {
            location: result.location,
            obtainedAt: Date.now(),
          } satisfies UserLocationFix
          publishFix(fix)
          if (userInitiated) {
            callbacksRef.current.onRecenter([
              result.location.latitude,
              result.location.longitude,
            ])
          }
        } else if (userInitiated) {
          setError(getLocationFailureMessage(result.reason, 'map-centering'))
        }
      } catch {
        if (mountedRef.current && userInitiated) {
          setError(getLocationFailureMessage('unavailable', 'map-centering'))
        }
      } finally {
        if (mountedRef.current && userInitiated) setIsLocating(false)
        activeRequestRef.current = null
      }
    })()

    activeRequestRef.current = request
    return request
  }, [publishFix])

  const refreshGrantedLocation = useCallback(() => {
    if (
      permissionStateRef.current !== 'granted' ||
      document.visibilityState !== 'visible'
    ) {
      return
    }

    const fix = fixRef.current
    const age = fix ? Date.now() - fix.obtainedAt : Number.POSITIVE_INFINITY
    if (fix && age > MAP_LOCATION_EXPIRY_MS) {
      publishFix(undefined)
    }
    if (!fix || age >= MAP_LOCATION_REFRESH_MS) {
      void requestFix(false)
    }
  }, [publishFix, requestFix])

  useEffect(() => {
    mountedRef.current = true
    const stopWatching = watchPermissionState('geolocation', (state) => {
      permissionStateRef.current = state
      if (state === 'denied') {
        publishFix(undefined)
        return
      }
      if (state === 'granted') refreshGrantedLocation()
    })
    const refreshTimer = window.setInterval(
      refreshGrantedLocation,
      MAP_LOCATION_REFRESH_MS,
    )

    return () => {
      mountedRef.current = false
      stopWatching()
      window.clearInterval(refreshTimer)
      activeRequestRef.current = null
    }
  }, [publishFix, refreshGrantedLocation])

  const locate = useCallback(() => requestFix(true), [requestFix])

  return { error, isLocating, locate }
}
