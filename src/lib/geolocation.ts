import type { LocationPoint } from '@/types/report'
import { isWithinServiceArea } from './serviceArea'

const fallbackMessage =
  'Location access is unavailable. Retry with a clearer device signal so the exact site can be verified.'

export function getGeolocationFallbackMessage() {
  return fallbackMessage
}

export async function requestCurrentPosition(): Promise<LocationPoint> {
  if (!navigator.geolocation) {
    if (import.meta.env.DEV) {
      console.warn('Geolocation API not supported. Falling back to mock KL location in DEV mode.')
      return {
        latitude: 3.13902,
        longitude: 101.68692,
        accuracyMeters: 42,
        source: 'browser',
      }
    }
    throw new Error(fallbackMessage)
  }

  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LocationPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          source: 'browser',
        }

        if (import.meta.env.DEV && !isWithinServiceArea(coords)) {
          console.warn('Retrieved coordinates are outside Kuala Lumpur. Overriding with mock KL location in DEV mode:', coords)
          resolve({
            latitude: 3.13902,
            longitude: 101.68692,
            accuracyMeters: 42,
            source: 'browser',
          })
          return
        }

        resolve(coords)
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.warn('Geolocation failed or was denied. Falling back to mock KL location in DEV mode:', error)
          resolve({
            latitude: 3.13902,
            longitude: 101.68692,
            accuracyMeters: 42,
            source: 'browser',
          })
          return
        }

        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              'Location permission was denied. Allow device location access to verify the exact site.',
            ),
          )
          return
        }

        reject(new Error(fallbackMessage))
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    )
  })
}
