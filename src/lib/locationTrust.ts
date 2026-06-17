import type { LocationPoint } from '@/types/report'

export const MAX_DETECTED_ACCURACY_METERS = 250
export const MIN_ALLOWED_CORRECTION_RADIUS_METERS = 75
const EARTH_RADIUS_METERS = 6_371_000

export function distanceMetersBetween(a: LocationPoint, b: LocationPoint) {
  const deltaLatitude = ((b.latitude - a.latitude) * Math.PI) / 180
  const deltaLongitude = ((b.longitude - a.longitude) * Math.PI) / 180
  const startLatitude = (a.latitude * Math.PI) / 180
  const endLatitude = (b.latitude * Math.PI) / 180
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function allowedCorrectionRadiusMeters(accuracyMeters?: number | null) {
  if (typeof accuracyMeters !== 'number' || Number.isNaN(accuracyMeters)) {
    return null
  }

  return Math.min(
    Math.max(accuracyMeters, MIN_ALLOWED_CORRECTION_RADIUS_METERS),
    MAX_DETECTED_ACCURACY_METERS,
  )
}

export function hasTrustedDetectedLocation(location?: LocationPoint | null) {
  return Boolean(
    location?.source === 'browser' &&
      typeof location.accuracyMeters === 'number' &&
      location.accuracyMeters > 0 &&
      location.accuracyMeters <= MAX_DETECTED_ACCURACY_METERS,
  )
}

export function isWithinAllowedCorrectionRadius(
  detectedLocation?: LocationPoint | null,
  selectedLocation?: LocationPoint | null,
) {
  if (!detectedLocation || !selectedLocation || !hasTrustedDetectedLocation(detectedLocation)) {
    return false
  }

  const allowedRadius = allowedCorrectionRadiusMeters(detectedLocation.accuracyMeters)
  if (allowedRadius === null) {
    return false
  }

  return distanceMetersBetween(detectedLocation, selectedLocation) <= allowedRadius
}
