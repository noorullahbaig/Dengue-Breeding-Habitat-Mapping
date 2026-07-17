import {
  getLocationFailureMessage,
  requestCurrentLocation,
  type LocationFailureReason,
} from './geolocation'

type GeolocationRequest = {
  success: PositionCallback
  error: PositionErrorCallback | null
  options?: PositionOptions
}

function installGeolocation() {
  let request: GeolocationRequest | undefined
  const getCurrentPosition = vi.fn(
    (
      success: PositionCallback,
      error: PositionErrorCallback | null,
      options?: PositionOptions,
    ) => {
      request = { success, error, options }
    },
  )

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })

  return {
    getCurrentPosition,
    get request() {
      return request
    },
  }
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value,
  })
}

describe('requestCurrentLocation', () => {
  beforeEach(() => {
    setSecureContext(true)
    Object.defineProperty(document, 'permissionsPolicy', {
      configurable: true,
      value: undefined,
    })
  })

  it('returns the browser location and uses the verification profile', async () => {
    const geolocation = installGeolocation()

    const resultPromise = requestCurrentLocation({ mode: 'verification' })
    geolocation.request?.success({
      coords: {
        latitude: 3.139,
        longitude: 101.6869,
        accuracy: 24,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1,
      toJSON: () => ({}),
    })

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      location: {
        latitude: 3.139,
        longitude: 101.6869,
        accuracyMeters: 24,
        source: 'browser',
      },
    })
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce()
    expect(geolocation.request?.options).toEqual({
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 0,
    })
  })

  it('uses the cached-position profile for map centering', () => {
    const geolocation = installGeolocation()

    void requestCurrentLocation({ mode: 'map-centering' })

    expect(geolocation.request?.options).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    })
  })

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const)('maps browser error code %s to %s', async (code, reason) => {
    const geolocation = installGeolocation()
    const resultPromise = requestCurrentLocation({ mode: 'verification' })

    geolocation.request?.error?.({
      code,
      message: 'Browser diagnostic only',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    })

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason,
      browserCode: code,
    })
  })

  it('rejects insecure contexts before calling the browser API', async () => {
    const geolocation = installGeolocation()
    setSecureContext(false)

    await expect(
      requestCurrentLocation({ mode: 'verification' }),
    ).resolves.toEqual({ ok: false, reason: 'insecure-context' })
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('detects a geolocation Permissions Policy block', async () => {
    const geolocation = installGeolocation()
    Object.defineProperty(document, 'permissionsPolicy', {
      configurable: true,
      value: { allowsFeature: vi.fn(() => false) },
    })

    await expect(
      requestCurrentLocation({ mode: 'verification' }),
    ).resolves.toEqual({ ok: false, reason: 'policy-blocked' })
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('reports browsers without a geolocation implementation', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })

    await expect(
      requestCurrentLocation({ mode: 'verification' }),
    ).resolves.toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('getLocationFailureMessage', () => {
  it.each<[LocationFailureReason, string]>([
    ['denied', 'Location access is blocked for this website.'],
    ['timeout', "We couldn't get your location within 12 seconds."],
    ['unavailable', 'Your device could not determine its location.'],
    ['insecure-context', 'Location requires a secure HTTPS connection.'],
    ['policy-blocked', 'Location is blocked by the page or browser that opened this site.'],
    ['unsupported', 'This browser does not provide website location.'],
  ])('provides actionable copy for %s', (reason, expectedStart) => {
    expect(getLocationFailureMessage(reason)).toMatch(expectedStart)
  })

  it('uses the map-centering timeout in map recovery copy', () => {
    expect(getLocationFailureMessage('timeout', 'map-centering')).toContain(
      'within 10 seconds',
    )
  })
})
