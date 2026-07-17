import type { LocationPoint } from '@/types/report'

export type LocationRequestMode = 'verification' | 'map-centering'

export type LocationFailureReason =
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'insecure-context'
  | 'policy-blocked'
  | 'unsupported'

export type LocationRequestResult =
  | { ok: true; location: LocationPoint }
  | {
      ok: false
      reason: LocationFailureReason
      browserCode?: number
    }

interface LocationFeaturePolicy {
  allowsFeature(feature: string): boolean
}

const POSITION_OPTIONS: Record<LocationRequestMode, Required<PositionOptions>> = {
  verification: {
    enableHighAccuracy: true,
    timeout: 12_000,
    maximumAge: 0,
  },
  'map-centering': {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 30_000,
  },
}

const REQUEST_WATCHDOG_TIMEOUT_MS = 30_000

const FAILURE_MESSAGES: Record<Exclude<LocationFailureReason, 'timeout'>, string> = {
  denied:
    'Location access is blocked for this website. In Safari, change the website Location setting to Ask or Allow and confirm iOS Location Services are on, then try again.',
  unavailable:
    'Your device could not determine its location. Turn on Location Services, Wi-Fi, and Precise Location, then try again.',
  'insecure-context':
    'Location requires a secure HTTPS connection. Open the official secure site and try again.',
  'policy-blocked':
    'Location is blocked by the page or browser that opened this site. Open the site directly in Safari and try again.',
  unsupported:
    'This browser does not provide website location. Open the site in Safari or another supported browser.',
}

export function getLocationFailureMessage(
  reason: LocationFailureReason,
  mode: LocationRequestMode = 'verification',
) {
  if (reason === 'timeout') {
    const timeoutSeconds = POSITION_OPTIONS[mode].timeout / 1_000
    return `We couldn't get your location within ${timeoutSeconds} seconds. Move near a window, make sure Location Services and Wi-Fi are on, then try again.`
  }
  return FAILURE_MESSAGES[reason]
}

function getLocationPolicy(): LocationFeaturePolicy | undefined {
  const documentWithPolicy = document as Document & {
    permissionsPolicy?: LocationFeaturePolicy
    featurePolicy?: LocationFeaturePolicy
  }
  return documentWithPolicy.permissionsPolicy ?? documentWithPolicy.featurePolicy
}

function isLocationBlockedByPolicy() {
  const policy = getLocationPolicy()
  if (!policy) return false

  try {
    return !policy.allowsFeature('geolocation')
  } catch {
    return false
  }
}

function failureReasonForBrowserCode(code: number): LocationFailureReason {
  if (code === 1) return 'denied'
  if (code === 3) return 'timeout'
  return 'unavailable'
}

export function requestCurrentLocation({
  mode,
}: {
  mode: LocationRequestMode
}): Promise<LocationRequestResult> {
  if (window.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: 'insecure-context' })
  }
  if (isLocationBlockedByPolicy()) {
    return Promise.resolve({ ok: false, reason: 'policy-blocked' })
  }
  if (!navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' })
  }

  return new Promise((resolve) => {
    let settled = false
    let watchdogId: number | undefined

    function settle(result: LocationRequestResult) {
      if (settled) return
      settled = true
      if (watchdogId !== undefined) {
        window.clearTimeout(watchdogId)
      }
      resolve(result)
    }

    watchdogId = window.setTimeout(() => {
      settle({ ok: false, reason: 'timeout' })
    }, REQUEST_WATCHDOG_TIMEOUT_MS)

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          settle({
            ok: true,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
              source: 'browser',
            },
          })
        },
        (error) => {
          settle({
            ok: false,
            reason: failureReasonForBrowserCode(error.code),
            browserCode: error.code,
          })
        },
        POSITION_OPTIONS[mode],
      )
    } catch {
      settle({ ok: false, reason: 'unavailable' })
    }
  })
}
