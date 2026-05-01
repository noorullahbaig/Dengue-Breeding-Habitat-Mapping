import type { LocationPoint } from '@/types/report'

const fallbackMessage =
  'Location access is unavailable. You can continue with the demo Kuala Lumpur location, then adjust the map pin before submitting.'

export function getGeolocationFallbackMessage() {
  return fallbackMessage
}

export async function requestCurrentPosition(): Promise<LocationPoint> {
  if (!navigator.geolocation) {
    throw new Error(fallbackMessage)
  }

  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          source: 'browser',
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              'Location permission was denied. You can continue with the demo Kuala Lumpur location and reposition the pin before submitting.',
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
